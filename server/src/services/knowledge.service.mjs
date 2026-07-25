import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.mjs';
import { knowledgeRepository } from '../repositories/knowledge.repository.mjs';
import { embedTexts } from './embedding.service.mjs';
import { sanitizeFilename } from '../utils/sanitizeFilename.mjs';

const allowedTypes = new Set([
  'lore', 'law', 'tradition', 'house', 'character', 'server_rule', 'reference',
]);
const allowedExtensions = new Set(['.pdf', '.md', '.txt', '.docx']);
const allowedMimeByExtension = new Map([
  ['.pdf', new Set(['application/pdf'])],
  ['.md', new Set(['text/markdown', 'text/plain', 'application/octet-stream'])],
  ['.txt', new Set(['text/plain', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])],
]);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function chunkText(text, maxLength = 4_000, overlap = 400) {
  const clean = String(text || '').replace(/\r/g, '').trim();
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxLength, clean.length);
    if (end < clean.length) {
      const paragraph = clean.lastIndexOf('\n\n', end);
      const sentence = clean.lastIndexOf('. ', end);
      end = Math.max(start + 1_000, paragraph, sentence + 1);
      end = Math.min(end, clean.length);
    }
    const content = clean.slice(start, end).trim();
    if (content.length >= 80 || (content && chunks.length === 0)) chunks.push(content);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function publicDocument(document) {
  if (!document) return null;
  const safe = { ...document };
  delete safe.storagePath;
  delete safe.lockedAt;
  delete safe.lockedBy;
  return safe;
}

async function extractText(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  if (extension === '.md' || extension === '.txt') return buffer.toString('utf8');
  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
  throw httpError('Formato de documento nao suportado.');
}

export function createKnowledgeService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || knowledgeRepository,
    embed: dependencies.embed || embedTexts,
    storagePath: path.resolve(dependencies.storagePath || env.KNOWLEDGE_STORAGE_PATH),
    embeddingModel: dependencies.embeddingModel ?? env.EMBEDDING_MODEL,
    randomUUID: dependencies.randomUUID || crypto.randomUUID,
  };

  async function createDocument({ title, type, file }) {
    if (!file) throw httpError('Selecione um documento.');
    if (!allowedTypes.has(type)) throw httpError('Classificacao de documento invalida.');
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExtensions.has(extension)) {
      throw httpError('Use PDF, Markdown, TXT ou DOCX.');
    }
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime && !allowedMimeByExtension.get(extension)?.has(mime)) {
      throw httpError('O tipo do arquivo nao corresponde a extensao informada.');
    }
    const id = deps.randomUUID();
    await fs.mkdir(deps.storagePath, { recursive: true });
    const safeName = sanitizeFilename(file.originalname || `documento${extension}`);
    const storagePath = path.join(deps.storagePath, `${id}-${safeName}`);
    await fs.writeFile(storagePath, file.buffer, { flag: 'wx' });
    return publicDocument(await deps.repository.createDocument({
      id,
      title: String(title || path.parse(safeName).name).trim(),
      type,
      originalFilename: safeName,
      storagePath,
    }));
  }

  async function processDocument(document) {
    const text = await extractText(document.storagePath);
    const contentChunks = chunkText(text);
    if (!contentChunks.length) throw httpError('Nao foi possivel extrair texto util do documento.', 422);
    let embeddings = [];
    if (deps.embeddingModel) {
      try {
        embeddings = await deps.embed(contentChunks);
      } catch {
        embeddings = [];
      }
    }
    await deps.repository.replaceChunks(document.id, contentChunks.map((content, index) => ({
      content,
      section: `Trecho ${index + 1}`,
      page: null,
      metadata: { documentTitle: document.title, chunk: index + 1 },
      embedding: embeddings[index] || null,
      embeddingModel: embeddings[index] ? deps.embeddingModel : null,
      embeddingStatus: embeddings[index] ? 'ready' : 'skipped',
    })));
  }

  async function listDocuments() {
    return (await deps.repository.listDocuments()).map(publicDocument);
  }

  async function getDocument(id) {
    const document = await deps.repository.getDocument(id);
    if (!document) throw httpError('Documento nao encontrado.', 404);
    return publicDocument(document);
  }

  async function reprocessDocument(id) {
    const document = await deps.repository.reprocessDocument(id);
    if (!document) throw httpError('Documento nao encontrado.', 404);
    return publicDocument(document);
  }

  async function deleteDocument(id) {
    const document = await deps.repository.deleteDocument(id);
    if (!document) throw httpError('Documento nao encontrado.', 404);
    await fs.rm(document.storagePath, { force: true });
    return { ok: true, deleted: { id } };
  }

  return {
    createDocument,
    processDocument,
    listDocuments,
    getDocument,
    reprocessDocument,
    deleteDocument,
    chunkText,
  };
}

export const knowledgeService = createKnowledgeService();
