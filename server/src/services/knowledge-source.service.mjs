import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.mjs';
import { knowledgeRepository } from '../repositories/knowledge.repository.mjs';
import { sanitizeFilename } from '../utils/sanitizeFilename.mjs';

const textExtensions = new Set(['.md', '.txt']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/').toLowerCase();
}

export function classifyKnowledgeSource(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  if (/lei|leis|justica|justiça/.test(normalized)) return 'law';
  if (/tradicao|tradição|religiao|religião|crenca|crença/.test(normalized)) return 'tradition';
  if (
    /stark|tully|arryn|lannister|tyrell|baratheon|martell|greyjoy|targaryen/.test(normalized)
    || /(?:^|[-_])casas?(?:[-_.]|$)/.test(normalized)
  ) {
    return 'house';
  }
  if (/system-prompt|metodo|método|fonte|bibliografia|reference/.test(normalized)) return 'reference';
  return 'lore';
}

export function titleFromKnowledgeSource(content, fileName) {
  const heading = String(content || '').match(/^\s*#{1,6}\s+(.+?)\s*$/m)?.[1];
  return String(heading || path.parse(fileName).name)
    .replace(/[*_`]/g, '')
    .trim();
}

export async function discoverKnowledgeFiles(sourcePath, fsApi = fs) {
  const root = path.resolve(sourcePath);
  let stat;
  try {
    stat = await fsApi.stat(root);
  } catch {
    throw httpError('Pasta de conhecimento nao encontrada.', 404);
  }
  if (!stat.isDirectory()) throw httpError('KNOWLEDGE_SOURCE_PATH deve apontar para uma pasta.');

  const files = [];
  async function visit(directory) {
    const entries = await fsApi.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath),
        });
      }
    }
  }
  await visit(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function createKnowledgeSourceService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || knowledgeRepository,
    storagePath: path.resolve(dependencies.storagePath || env.KNOWLEDGE_STORAGE_PATH),
    fs: dependencies.fs || fs,
    randomUUID: dependencies.randomUUID || crypto.randomUUID,
  };

  async function syncDirectory({ sourcePath, dryRun = false }) {
    const resolvedSource = String(sourcePath || env.KNOWLEDGE_SOURCE_PATH || '').trim();
    if (!resolvedSource) throw httpError('KNOWLEDGE_SOURCE_PATH nao configurado.');
    const files = await discoverKnowledgeFiles(resolvedSource, deps.fs);
    if (!files.length) throw httpError('A pasta de conhecimento nao possui arquivos MD ou TXT.', 422);
    if (!dryRun) await deps.fs.mkdir(path.join(deps.storagePath, 'imported'), { recursive: true });

    const summary = {
      discovered: files.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      queued: 0,
      files: [],
    };

    for (const file of files) {
      const content = await deps.fs.readFile(file.absolutePath, 'utf8');
      const relativePath = normalizeRelativePath(file.relativePath);
      const sourceKey = `directory:${relativePath}`;
      const sourceHash = crypto.createHash('sha256').update(content).digest('hex');
      const title = titleFromKnowledgeSource(content, file.relativePath);
      const type = classifyKnowledgeSource(file.relativePath);
      const fileName = sanitizeFilename(path.basename(file.relativePath));
      const sourceId = crypto.createHash('sha256').update(sourceKey).digest('hex').slice(0, 16);
      const storagePath = path.join(
        deps.storagePath,
        'imported',
        `${sourceId}-${sourceHash.slice(0, 12)}-${fileName}`,
      );
      let state = 'validated';

      if (!dryRun) {
        const existing = await deps.repository.getDocumentBySourceKey(sourceKey);
        if (existing?.sourceHash === sourceHash && existing.status !== 'failed') {
          summary.unchanged += 1;
          state = 'unchanged';
        } else {
          await deps.fs.writeFile(storagePath, content, { flag: 'wx' }).catch(async (error) => {
            if (error.code !== 'EEXIST') throw error;
          });
          await deps.repository.upsertSourceDocument({
            id: existing?.id || deps.randomUUID(),
            title,
            type,
            originalFilename: fileName,
            storagePath,
            sourceKey,
            sourceHash,
          });
          if (existing) summary.updated += 1;
          else summary.created += 1;
          summary.queued += 1;
          state = existing ? 'updated' : 'created';
          if (existing?.storagePath && existing.storagePath !== storagePath) {
            await deps.fs.rm(existing.storagePath, { force: true }).catch(() => {});
          }
        }
      }

      summary.files.push({ relativePath: file.relativePath, title, type, state });
    }
    return summary;
  }

  return { syncDirectory };
}

export const knowledgeSourceService = createKnowledgeSourceService();
