import fs from 'node:fs/promises';
import path from 'node:path';
import { messagesService } from './messages.service.mjs';
import { createId } from '../utils/ids.mjs';
import { logger } from '../utils/logger.mjs';

const automationsRoot = path.join(process.cwd(), 'server', 'automations');
const automations = new Map();
const timers = new Map();
const validActions = new Set(['pause', 'resume', 'cancel']);
const statusOrder = new Map([
  ['running', 0],
  ['paused', 1],
  ['error', 2],
  ['done', 3],
  ['cancelled', 4],
]);

function nowIso() {
  return new Date().toISOString();
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateAutomationId(automationId) {
  const id = String(automationId || '');
  if (!id.startsWith('automation_') || id.includes('/') || id.includes('\\')) {
    throw httpError('Automacao invalida.', 400);
  }
  return id;
}

function automationFilePath(automationId) {
  const id = validateAutomationId(automationId);
  const resolved = path.resolve(automationsRoot, `${id}.json`);
  const root = path.resolve(automationsRoot);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw httpError('Automacao invalida.', 400);
  return resolved;
}

function normalizeMessageInput(message, index) {
  if (typeof message !== 'string') throw httpError(`Mensagem ${index + 1} precisa ser texto.`, 400);
  const content = message.trim();
  if (!content) throw httpError(`Mensagem ${index + 1} esta vazia.`, 400);
  return {
    id: createId('msg'),
    position: index,
    content,
    status: 'queued',
    discordMessageId: null,
    sentAt: null,
    error: null,
  };
}

function normalizeScheduleAt(value) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) throw httpError('Data e hora do agendamento sao obrigatorias.', 400);
  if (date.getTime() <= Date.now()) throw httpError('Agendamento precisa estar no futuro.', 400);
  return date.toISOString();
}

function currentMessage(automation) {
  return automation.messages[automation.currentIndex] || null;
}

function hasPendingMessages(automation) {
  return automation.messages.some((message) => message.status !== 'sent');
}

function markDoneIfComplete(automation) {
  if (automation.currentIndex >= automation.messages.length || !hasPendingMessages(automation)) {
    automation.status = 'done';
    automation.currentIndex = automation.messages.length;
    automation.nextRunAt = null;
    automation.completedAt = automation.completedAt || nowIso();
    return true;
  }
  return false;
}

export function validateAutomationInput(input) {
  if (!input || typeof input !== 'object') throw httpError('Payload obrigatorio.', 400);
  const channelId = String(input.channelId || '').trim();
  if (!channelId) throw httpError('Canal obrigatorio.', 400);
  const mode = input.mode === 'scheduled' ? 'scheduled' : 'sequence';

  if (!Array.isArray(input.messages)) throw httpError('Mensagens devem ser uma lista.', 400);
  if (input.messages.length < 1) throw httpError('Informe ao menos uma mensagem.', 400);
  if (mode === 'scheduled' && input.messages.length !== 1) throw httpError('Agendamento aceita uma mensagem por vez.', 400);
  if (input.messages.length > 100) throw httpError('Informe no maximo 100 mensagens.', 400);

  const intervalSeconds = Number(input.intervalSeconds);
  const normalizedInterval = mode === 'scheduled' ? 0 : Math.trunc(intervalSeconds);
  if (mode !== 'scheduled') {
    if (!Number.isFinite(intervalSeconds)) throw httpError('Intervalo obrigatorio.', 400);
    if (normalizedInterval < 1) throw httpError('Intervalo minimo e 1 segundo.', 400);
    if (normalizedInterval > 86400) throw httpError('Intervalo maximo e 86400 segundos.', 400);
  }

  return {
    mode,
    channelId,
    channelName: input.channelName ? String(input.channelName).trim() || null : null,
    intervalSeconds: normalizedInterval,
    scheduledAt: mode === 'scheduled' ? normalizeScheduleAt(input.scheduledAt) : null,
    messages: input.messages.map(normalizeMessageInput),
  };
}

export async function saveAutomation(automation) {
  const filePath = automationFilePath(automation.id);
  await fs.mkdir(automationsRoot, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(automation, null, 2));
  await fs.rename(tempPath, filePath);
  return automation;
}

export async function loadAutomationFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const automation = JSON.parse(raw);
  validateAutomationId(automation.id);
  if (!Array.isArray(automation.messages)) throw new Error('Arquivo de automacao sem mensagens.');
  return automation;
}

export async function loadAutomations() {
  await fs.mkdir(automationsRoot, { recursive: true });
  const entries = await fs.readdir(automationsRoot, { withFileTypes: true });
  automations.clear();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(automationsRoot, entry.name);
    try {
      const automation = await loadAutomationFile(filePath);
      automations.set(automation.id, automation);
    } catch (error) {
      logger.warn('Ignorando arquivo de automacao invalido.', { file: entry.name, reason: error.message });
    }
  }

  return [...automations.values()];
}

export async function initAutomations() {
  const loaded = await loadAutomations();
  for (const automation of loaded) {
    if (automation.status === 'running') scheduleAutomation(automation);
  }
  logger.info(`Automacoes carregadas: ${loaded.length}`);
  return loaded;
}

export function getAutomation(automationId) {
  const id = validateAutomationId(automationId);
  const automation = automations.get(id);
  if (!automation) throw httpError('Automacao nao encontrada.', 404);
  return automation;
}

export function getAutomationSummary(automation) {
  const messages = automation.messages || [];
  const sentCount = messages.filter((message) => message.status === 'sent').length;
  const errorCount = messages.filter((message) => message.status === 'error').length;
  const queuedCount = messages.filter((message) => message.status === 'queued' || message.status === 'sending').length;
  const totalCharacters = messages.reduce((total, message) => total + String(message.content || '').length, 0);
  return {
    ...automation,
    totalMessages: messages.length,
    totalCharacters,
    sentCount,
    errorCount,
    queuedCount,
    preview: messages.slice(0, 3).map((message) => (
      message.content.length > 120 ? `${message.content.slice(0, 117)}...` : message.content
    )),
  };
}

export function listAutomations() {
  return [...automations.values()]
    .map(getAutomationSummary)
    .sort((a, b) => {
      const order = (statusOrder.get(a.status) ?? 9) - (statusOrder.get(b.status) ?? 9);
      if (order !== 0) return order;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

export function cancelAutomationTimer(automationId) {
  const id = String(automationId || '');
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

export function scheduleAutomation(automation) {
  cancelAutomationTimer(automation.id);
  if (automation.status !== 'running') return;

  if (markDoneIfComplete(automation)) {
    saveAutomation(automation).catch((error) => logger.warn('Falha ao salvar automacao concluida.', { id: automation.id, reason: error.message }));
    return;
  }

  const delay = Math.max(0, new Date(automation.nextRunAt || nowIso()).getTime() - Date.now());
  const timer = setTimeout(() => {
    runAutomationTick(automation.id).catch((error) => {
      logger.error('Erro inesperado em tick de automacao.', { id: automation.id, reason: error.message });
    });
  }, delay);
  timers.set(automation.id, timer);
}

export async function createAutomation(input) {
  const valid = validateAutomationInput(input);
  const channelInfo = await messagesService.assertMessageableChannel(valid.channelId);
  const timestamp = nowIso();
  const automation = {
    id: createId('automation'),
    mode: valid.mode,
    channelId: valid.channelId,
    channelName: valid.channelName || channelInfo.name || null,
    status: 'running',
    intervalSeconds: valid.intervalSeconds,
    scheduledAt: valid.scheduledAt,
    currentIndex: 0,
    messages: valid.messages,
    createdAt: timestamp,
    startedAt: valid.mode === 'scheduled' ? null : timestamp,
    nextRunAt: valid.mode === 'scheduled' ? valid.scheduledAt : timestamp,
    completedAt: null,
    lastError: null,
  };
  automations.set(automation.id, automation);
  await saveAutomation(automation);
  scheduleAutomation(automation);
  return automation;
}

export async function runAutomationTick(automationId) {
  const automation = automations.get(String(automationId || ''));
  if (!automation || automation.status !== 'running') return;

  const message = currentMessage(automation);
  if (!message) {
    markDoneIfComplete(automation);
    cancelAutomationTimer(automation.id);
    await saveAutomation(automation);
    return;
  }

  message.status = 'sending';
  message.error = null;
  await saveAutomation(automation);

  try {
    const result = await messagesService.sendMessage({
      channelId: automation.channelId,
      content: message.content,
      files: [],
      allowedMentions: { parse: ['users', 'roles', 'everyone'] },
    });
    if (automation.status !== 'running') {
      await saveAutomation(automation);
      return;
    }
    message.status = 'sent';
    message.discordMessageId = result.message?.id || null;
    message.sentAt = nowIso();
    message.error = null;
    automation.startedAt = automation.startedAt || message.sentAt;
    automation.currentIndex += 1;
    automation.lastError = null;

    if (markDoneIfComplete(automation)) {
      cancelAutomationTimer(automation.id);
      await saveAutomation(automation);
      return;
    }

    automation.nextRunAt = new Date(Date.now() + automation.intervalSeconds * 1000).toISOString();
    await saveAutomation(automation);
    scheduleAutomation(automation);
  } catch (error) {
    message.status = 'error';
    message.error = error.message || 'Falha ao enviar mensagem.';
    automation.status = 'error';
    automation.lastError = message.error;
    automation.nextRunAt = null;
    cancelAutomationTimer(automation.id);
    await saveAutomation(automation);
  }
}

export async function updateAutomationAction(automationId, actionInput) {
  const action = String(actionInput || '');
  if (!validActions.has(action)) throw httpError('Acao invalida. Use pause, resume ou cancel.', 400);
  const automation = getAutomation(automationId);

  if (action === 'pause') {
    if (automation.status !== 'running') throw httpError('Apenas automacoes em execucao podem ser pausadas.', 400);
    automation.status = 'paused';
    automation.nextRunAt = null;
    cancelAutomationTimer(automation.id);
    await saveAutomation(automation);
    return automation;
  }

  if (action === 'resume') {
    if (!['paused', 'error'].includes(automation.status)) {
      throw httpError('Apenas automacoes pausadas ou com erro podem ser retomadas.', 400);
    }
    if (markDoneIfComplete(automation)) {
      await saveAutomation(automation);
      return automation;
    }
    const message = currentMessage(automation);
    if (message && ['error', 'sending'].includes(message.status)) {
      message.status = 'queued';
      message.error = null;
    }
    automation.status = 'running';
    automation.lastError = null;
    automation.nextRunAt = automation.mode === 'scheduled' && automation.scheduledAt && new Date(automation.scheduledAt).getTime() > Date.now()
      ? automation.scheduledAt
      : nowIso();
    automation.completedAt = null;
    await saveAutomation(automation);
    scheduleAutomation(automation);
    return automation;
  }

  if (['done', 'cancelled'].includes(automation.status)) {
    throw httpError('Automacao ja esta finalizada.', 400);
  }
  automation.status = 'cancelled';
  automation.completedAt = nowIso();
  automation.nextRunAt = null;
  cancelAutomationTimer(automation.id);
  await saveAutomation(automation);
  return automation;
}

export function ensureAutomationCanBeDeleted(_automation) {
  return true;
}

export async function deleteAutomation(automationId) {
  const automation = getAutomation(automationId);
  ensureAutomationCanBeDeleted(automation);
  cancelAutomationTimer(automation.id);
  if (automation.status === 'running') automation.status = 'cancelled';
  automations.delete(automation.id);
  await fs.rm(automationFilePath(automation.id), { force: true });
  return { ok: true, deleted: { automationId: automation.id } };
}

export const automationsService = {
  initAutomations,
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomationAction,
  deleteAutomation,
  saveAutomation,
  loadAutomationFile,
  loadAutomations,
  scheduleAutomation,
  cancelAutomationTimer,
  runAutomationTick,
  getAutomationSummary,
  validateAutomationInput,
  ensureAutomationCanBeDeleted,
};
