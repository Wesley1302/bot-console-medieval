import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { channelKind, channelsService, normalizeChannel } from './channels.service.mjs';
import { messagesService } from './messages.service.mjs';
import { createId } from '../utils/ids.mjs';
import { sanitizeFilename } from '../utils/sanitizeFilename.mjs';
import { sleep } from '../utils/sleep.mjs';

const exportsRoot = path.join(process.cwd(), 'server', 'exports');
const jobs = new Map();
const validTargetTypes = new Set(['text', 'announcement', 'thread', 'forum', 'category']);
const validFormats = new Set(['json', 'md', 'txt']);
const validModes = new Set(['combined', 'separate']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function updateJob(job, patch) {
  Object.assign(job, patch);
  return job;
}

function validateTarget(target) {
  if (!target || typeof target !== 'object') throw httpError('Target obrigatorio.');
  if (!target.id) throw httpError('target.id obrigatorio.');
  if (!target.name) throw httpError('target.name obrigatorio.');
  if (!target.type) throw httpError('target.type obrigatorio.');
  if (!validTargetTypes.has(target.type)) throw httpError('Tipo de target invalido para exportacao.');
  return {
    id: String(target.id),
    name: String(target.name),
    type: String(target.type),
  };
}

function validateExportId(exportId) {
  const id = String(exportId || '');
  if (!id.startsWith('export_') || id.includes('/') || id.includes('\\')) {
    throw httpError('Exportacao invalida.', 400);
  }
  return id;
}

function exportDir(exportId) {
  const id = validateExportId(exportId);
  const resolved = path.resolve(exportsRoot, id);
  const root = path.resolve(exportsRoot);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw httpError('Exportacao invalida.', 400);
  return resolved;
}

function conversationFromChannel(channel, extra = {}) {
  const normalized = channel.type ? normalizeChannel(channel) : channel;
  return {
    id: normalized.id,
    name: normalized.name,
    type: normalized.type,
    parentId: normalized.parentId || null,
    parentName: extra.parentName || normalized.parentName || null,
    emptyOnly: Boolean(extra.emptyOnly),
  };
}

export function createExportJob(targetInput) {
  const target = validateTarget(targetInput);
  const job = {
    id: createId('job'),
    status: 'queued',
    target,
    progress: 0,
    step: 'Na fila',
    totalConversations: 0,
    completedConversations: 0,
    totalMessages: 0,
    exportId: null,
    error: '',
    warnings: [],
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
  };
  jobs.set(job.id, job);
  setTimeout(() => runExportJob(job.id), 0);
  return { ok: true, jobId: job.id, status: job.status };
}

export function getExportJob(jobId) {
  const job = jobs.get(String(jobId || ''));
  if (!job) throw httpError('Job de exportacao nao encontrado.', 404);
  return job;
}

export async function expandTargetToConversations(target, job) {
  updateJob(job, { step: 'Buscando conversas', progress: 5 });
  if (['text', 'announcement'].includes(target.type)) {
    const activeThreads = await channelsService.listActiveThreads();
    return [
      { id: target.id, name: target.name, type: target.type, parentId: null, parentName: null },
      ...activeThreads
        .filter((thread) => String(thread.parent_id) === target.id)
        .map((thread) => conversationFromChannel(thread, { parentName: target.name })),
    ];
  }

  if (target.type === 'thread') {
    return [{ id: target.id, name: target.name, type: 'thread', parentId: null, parentName: null }];
  }

  if (target.type === 'forum') {
    const payload = await channelsService.listForumThreads(target.id);
    job.warnings.push(...(payload.warnings || []));
    if (!payload.threads.length) {
      return [{ id: target.id, name: target.name, type: 'forum', parentId: null, parentName: null, emptyOnly: true }];
    }
    return payload.threads.map((thread) => ({ ...thread, parentName: target.name }));
  }

  const guildChannels = await channelsService.listGuildChannels();
  const children = guildChannels.filter((channel) => String(channel.parent_id || '') === target.id);
  const activeThreads = await channelsService.listActiveThreads();
  const conversations = [];

  for (const child of children.sort((a, b) => Number(a.position || 0) - Number(b.position || 0))) {
    const kind = channelKind(child.type);
    if (kind === 'voice') continue;
    if (['text', 'announcement'].includes(kind)) {
      const normalized = conversationFromChannel(child, { parentName: target.name });
      conversations.push(normalized);
      conversations.push(...activeThreads
        .filter((thread) => String(thread.parent_id) === normalized.id)
        .map((thread) => conversationFromChannel(thread, { parentName: normalized.name })));
    }
    if (kind === 'forum') {
      const forum = normalizeChannel(child);
      const payload = await channelsService.listForumThreads(forum.id);
      job.warnings.push(...(payload.warnings || []));
      conversations.push(...payload.threads.map((thread) => ({ ...thread, parentName: forum.name })));
    }
  }

  return conversations;
}

export async function fetchAllMessagesForExport(channelId, job) {
  const messages = [];
  let before = '';
  try {
    for (;;) {
      updateJob(job, { step: 'Baixando mensagens' });
      const payload = await messagesService.listMessages(channelId, { limit: 100, before });
      messages.unshift(...payload.messages.filter((message) => !messages.some((item) => item.id === message.id)));
      job.totalMessages += payload.messages.length;
      if (!payload.hasMore || !payload.messages.length) break;
      before = payload.messages[0].id;
      await sleep(350);
    }
    return { messages: messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)), error: null };
  } catch (error) {
    return { messages: [], error: { channelId: String(channelId), message: error.message } };
  }
}

export function buildExportData({ exportId, target, conversations, warnings, errors, createdAt }) {
  const completedAt = nowIso();
  const normalizedConversations = conversations.map((conversation) => ({
    id: conversation.id,
    name: conversation.name,
    type: conversation.type,
    parentId: conversation.parentId || null,
    parentName: conversation.parentName || null,
    messageCount: conversation.messages?.length || 0,
    messages: conversation.messages || [],
  }));
  return {
    id: exportId,
    target,
    createdAt: createdAt || completedAt,
    completedAt,
    summary: {
      totalConversations: normalizedConversations.length,
      totalMessages: normalizedConversations.reduce((total, item) => total + item.messageCount, 0),
      totalErrors: errors.length,
      totalWarnings: warnings.length,
    },
    conversations: normalizedConversations,
    warnings,
    errors,
  };
}

function authorName(message) {
  return message.author?.serverName || message.author?.displayName || message.author?.globalName || message.author?.username || 'Usuario';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'sem data';
}

export function renderMarkdown(exportData) {
  const lines = [
    `# Exportacao - ${exportData.target.name}`,
    '',
    `- Tipo: ${exportData.target.type}`,
    `- Criada em: ${exportData.createdAt}`,
    `- Concluida em: ${exportData.completedAt}`,
    `- Total de conversas: ${exportData.summary.totalConversations}`,
    `- Total de mensagens: ${exportData.summary.totalMessages}`,
    `- Erros: ${exportData.summary.totalErrors}`,
    `- Avisos: ${exportData.summary.totalWarnings}`,
    '',
  ];

  for (const conversation of exportData.conversations) {
    lines.push(`## Conversa: ${conversation.name}`, '', `ID: ${conversation.id}`, `Tipo: ${conversation.type}`, '', '### Mensagens', '');
    if (!conversation.messages.length) lines.push('_Nenhuma mensagem encontrada._', '');
    for (const message of conversation.messages) {
      lines.push(`#### [${formatDate(message.timestamp)}] ${authorName(message)}`, '');
      if (message.content) lines.push(message.content, '');
      if (message.attachments?.length) {
        lines.push('Anexos:');
        for (const attachment of message.attachments) lines.push(`- ${attachment.filename}: ${attachment.url}`);
        lines.push('');
      }
      if (message.embeds?.length) {
        lines.push('Embeds:');
        for (const embed of message.embeds) lines.push(`- ${embed.title || embed.url || embed.description || embed.type || 'embed'}`);
        lines.push('');
      }
      if (message.stickers?.length) {
        lines.push('Stickers:');
        for (const sticker of message.stickers) lines.push(`- ${sticker.name || sticker.id}`);
        lines.push('');
      }
    }
  }

  lines.push('## Avisos', '', ...(exportData.warnings.length ? exportData.warnings.map((warning) => `- ${warning}`) : ['_Nenhum aviso._']), '', '## Erros', '', ...(exportData.errors.length ? exportData.errors.map((error) => `- ${error.name || error.channelId}: ${error.message}`) : ['_Nenhum erro._']), '');
  return lines.join('\n');
}

export function renderText(exportData) {
  const lines = [
    `EXPORTACAO: ${exportData.target.name}`,
    `TIPO: ${exportData.target.type}`,
    `CRIADA EM: ${exportData.createdAt}`,
    `CONCLUIDA EM: ${exportData.completedAt}`,
    `TOTAL DE CONVERSAS: ${exportData.summary.totalConversations}`,
    `TOTAL DE MENSAGENS: ${exportData.summary.totalMessages}`,
    '',
  ];
  for (const conversation of exportData.conversations) {
    lines.push('='.repeat(72), `CONVERSA: ${conversation.name}`, `ID: ${conversation.id}`, `TIPO: ${conversation.type}`, '='.repeat(72), '');
    if (!conversation.messages.length) lines.push('Nenhuma mensagem encontrada.', '');
    for (const message of conversation.messages) {
      lines.push(`[${formatDate(message.timestamp)}] ${authorName(message)}:`, message.content || '(sem texto)', '');
      if (message.attachments?.length) {
        lines.push('ANEXOS:');
        for (const attachment of message.attachments) lines.push(`- ${attachment.filename}: ${attachment.url}`);
        lines.push('');
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

export async function writeExportFiles(exportData) {
  const folder = exportDir(exportData.id);
  const manifest = {
    id: exportData.id,
    target: exportData.target,
    createdAt: exportData.createdAt,
    completedAt: exportData.completedAt,
    summary: exportData.summary,
    files: { json: 'data.json', md: 'export.md', txt: 'export.txt' },
  };
  await fs.mkdir(folder, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2)),
    fs.writeFile(path.join(folder, 'data.json'), JSON.stringify(exportData, null, 2)),
    fs.writeFile(path.join(folder, 'export.md'), renderMarkdown(exportData)),
    fs.writeFile(path.join(folder, 'export.txt'), renderText(exportData)),
  ]);
  return manifest;
}

export async function runExportJob(jobId) {
  const job = getExportJob(jobId);
  try {
    updateJob(job, { status: 'running', startedAt: nowIso(), step: 'Buscando conversas', progress: 2 });
    const exportId = createId('export');
    const conversations = await expandTargetToConversations(job.target, job);
    updateJob(job, { totalConversations: conversations.length, progress: 12 });
    const errors = [];
    const exported = [];

    for (const conversation of conversations) {
      if (conversation.emptyOnly) {
        exported.push({ ...conversation, messages: [] });
      } else {
        const result = await fetchAllMessagesForExport(conversation.id, job);
        if (result.error) errors.push({ ...result.error, name: conversation.name });
        exported.push({ ...conversation, messages: result.messages });
      }
      job.completedConversations += 1;
      job.progress = Math.min(88, Math.round((job.completedConversations / Math.max(job.totalConversations, 1)) * 80) + 10);
    }

    updateJob(job, { step: 'Gerando arquivos', progress: 92 });
    const exportData = buildExportData({
      exportId,
      target: job.target,
      conversations: exported,
      warnings: job.warnings,
      errors,
      createdAt: job.createdAt,
    });
    const manifest = await writeExportFiles(exportData);
    updateJob(job, {
      status: 'done',
      step: 'Concluido',
      progress: 100,
      exportId,
      totalMessages: manifest.summary.totalMessages,
      completedAt: manifest.completedAt,
      warnings: job.warnings,
    });
  } catch (error) {
    updateJob(job, { status: 'error', step: 'Erro', progress: 100, error: error.message, completedAt: nowIso() });
  }
}

export async function readManifest(exportId) {
  try {
    return JSON.parse(await fs.readFile(path.join(exportDir(exportId), 'manifest.json'), 'utf8'));
  } catch {
    throw httpError('Exportacao nao encontrada.', 404);
  }
}

export async function listExportPackages() {
  await fs.mkdir(exportsRoot, { recursive: true });
  const entries = await fs.readdir(exportsRoot, { withFileTypes: true });
  const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => readManifest(entry.name).catch(() => null)));
  return manifests.filter(Boolean).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

export async function getExportPackage(exportId) {
  try {
    return JSON.parse(await fs.readFile(path.join(exportDir(exportId), 'data.json'), 'utf8'));
  } catch {
    throw httpError('Exportacao nao encontrada.', 404);
  }
}

export async function deleteExportPackage(exportId) {
  await readManifest(exportId);
  await fs.rm(exportDir(exportId), { recursive: true, force: true });
  return { ok: true, deleted: { exportId: String(exportId) } };
}

export async function downloadExportFile(exportId, format = 'json') {
  if (!validFormats.has(format)) throw httpError('Formato invalido. Use json, md ou txt.');
  const manifest = await readManifest(exportId);
  const fileMap = { json: 'data.json', md: 'export.md', txt: 'export.txt' };
  const typeMap = { json: 'application/json', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8' };
  const ext = format;
  return {
    filePath: path.join(exportDir(exportId), fileMap[format]),
    filename: `${sanitizeFilename(manifest.target.name)}-${exportId}.${ext}`,
    contentType: typeMap[format],
  };
}

async function readExportRendered(exportId, format) {
  if (format === 'json') return JSON.stringify(await getExportPackage(exportId), null, 2);
  const file = await downloadExportFile(exportId, format);
  return fs.readFile(file.filePath, 'utf8');
}

export async function bulkDownloadExports({ ids, format = 'json', mode = 'combined' }) {
  if (!Array.isArray(ids) || ids.length === 0) throw httpError('Selecione ao menos uma exportacao.');
  if (ids.length > 50) throw httpError('Selecione no maximo 50 exportacoes por lote.');
  if (!validFormats.has(format)) throw httpError('Formato invalido. Use json, md ou txt.');
  if (!validModes.has(mode)) throw httpError('Modo invalido. Use combined ou separate.');

  const manifests = await Promise.all(ids.map(readManifest));
  if (mode === 'combined') {
    if (format === 'json') {
      const exports = await Promise.all(ids.map(getExportPackage));
      return {
        buffer: Buffer.from(JSON.stringify({ generatedAt: nowIso(), exports }, null, 2)),
        filename: 'downloads-selecionados.json',
        contentType: 'application/json',
      };
    }
    const content = (await Promise.all(ids.map((id) => readExportRendered(id, format)))).join('\n\n\n============================================================\n\n\n');
    return {
      buffer: Buffer.from(content),
      filename: `downloads-selecionados.${format}`,
      contentType: format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
    };
  }

  const zip = new JSZip();
  for (const manifest of manifests) {
    const folder = `${sanitizeFilename(manifest.target.name)}-${manifest.id.slice(-8)}`;
    const content = await readExportRendered(manifest.id, format);
    zip.file(`${folder}/${sanitizeFilename(manifest.target.name)}.${format}`, content);
  }
  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    filename: 'downloads-separados.zip',
    contentType: 'application/zip',
  };
}

export const exportsService = {
  createExportJob,
  getExportJob,
  runExportJob,
  listExportPackages,
  getExportPackage,
  deleteExportPackage,
  downloadExportFile,
  bulkDownloadExports,
  expandTargetToConversations,
  fetchAllMessagesForExport,
  buildExportData,
  writeExportFiles,
  renderMarkdown,
  renderText,
  readManifest,
};
