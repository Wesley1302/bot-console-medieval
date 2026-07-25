import assert from 'node:assert/strict';
import test from 'node:test';
import { createScopeResolver } from '../../server/src/services/scope-resolver.service.mjs';
import { createCleanupService } from '../../server/src/services/cleanup.service.mjs';
import { createCleanupWorker } from '../../server/src/workers/cleanup.worker.mjs';
import { createMessageIndexService } from '../../server/src/services/message-index.service.mjs';
import { validateQueryInput } from '../../server/src/services/ai.service.mjs';
import { createAiWorker } from '../../server/src/workers/ai.worker.mjs';
import { createKnowledgeService } from '../../server/src/services/knowledge.service.mjs';
import request from 'supertest';
import { createApp } from '../../server/src/app.mjs';

test('scope resolver expande categoria e remove alvos duplicados', async () => {
  const resolver = createScopeResolver({
    guildId: 'guild-1',
    listGuildChannels: async () => [
      { id: 'cat-1', name: 'Casa', type: 4 },
      { id: 'text-1', name: 'cenas', type: 0, parent_id: 'cat-1' },
      { id: 'forum-1', name: 'forum', type: 15, parent_id: 'cat-1' },
    ],
    listActiveThreads: async () => [
      { id: 'thread-1', name: 'topico', type: 11, parent_id: 'forum-1' },
    ],
    listThreads: async (id) => ({
      threads: id === 'forum-1'
        ? [{ id: 'thread-1', name: 'topico', type: 'thread', parentId: 'forum-1', messageable: true }]
        : [],
      warnings: [],
    }),
  });
  const scope = await resolver.resolve([
    { id: 'cat-1', type: 'category' },
    { id: 'forum-1', type: 'forum' },
    { id: 'thread-1', type: 'thread' },
  ]);
  assert.deepEqual(scope.resolvedChannels.map((item) => item.id), ['text-1']);
  assert.deepEqual(scope.resolvedThreads.map((item) => item.id), ['thread-1']);
});

test('limpeza exige token e texto reforcado antes de entrar na fila', async () => {
  let stored;
  const repository = {
    createPreview: async (input) => {
      stored = {
        ...input,
        confirmationToken: input.confirmationTokenHash,
        confirmationExpiresAt: input.expiresAt,
        status: 'awaiting_confirmation',
      };
      return stored;
    },
    getJob: async () => stored,
    confirmJob: async () => ({ ...stored, status: 'queued', confirmationToken: null }),
  };
  const service = createCleanupService({
    repository,
    resolver: {
      resolve: async () => ({
        resolvedChannels: [{ id: 'channel-1', name: 'canal', type: 'text' }],
        resolvedThreads: [],
        inaccessibleTargets: [],
        warnings: [],
      }),
    },
    index: { countByChannels: async () => 12 },
    guildId: 'guild-1',
    now: () => new Date('2026-07-25T12:00:00Z'),
    randomUUID: () => 'preview-1',
    randomBytes: () => Buffer.from('abcd', 'hex'),
    logger: { info() {}, warn() {}, error() {} },
  });
  const preview = await service.preview({ targetType: 'category', targetId: 'cat-1', targetName: 'Casa' });
  await assert.rejects(
    service.createJob({ previewId: preview.previewId, confirmationToken: 'errado', confirmationText: 'LIMPAR Casa' }),
    /Token de confirmacao invalido/,
  );
  await assert.rejects(
    service.createJob({ previewId: preview.previewId, confirmationToken: preview.confirmationToken, confirmationText: 'limpar' }),
    /Digite exatamente/,
  );
  const job = await service.createJob({
    previewId: preview.previewId,
    confirmationToken: preview.confirmationToken,
    confirmationText: 'LIMPAR Casa',
  });
  assert.equal(job.status, 'queued');
  assert.equal(job.confirmationToken, undefined);
});

test('token de limpeza expirado e rejeitado', async () => {
  const repository = {
    getJob: async () => ({
      id: 'preview-1',
      status: 'awaiting_confirmation',
      targetType: 'text',
      confirmationExpiresAt: '2026-07-25T11:59:00Z',
      confirmationToken: 'hash',
    }),
  };
  const service = createCleanupService({
    repository,
    now: () => new Date('2026-07-25T12:00:00Z'),
    logger: { info() {}, warn() {}, error() {} },
  });
  await assert.rejects(
    service.createJob({ previewId: 'preview-1', confirmationToken: 'token' }),
    /expirou/,
  );
});

test('worker remove indice somente depois de exclusao confirmada pelo Discord', async () => {
  const deletedFromIndex = [];
  const requests = [];
  const state = { status: 'running', lockedBy: 'worker-1', cancelRequestedAt: null };
  const repository = {
    getJob: async () => state,
    listPendingItems: async () => [],
    addItems: async () => {},
    markItems: async () => {},
    updateProgress: async () => {},
    heartbeat: async () => {},
  };
  const worker = createCleanupWorker({
    repository,
    index: { deleteMessages: async (ids) => deletedFromIndex.push(...ids) },
    workerId: 'worker-1',
    discordRequest: async (path, options = {}) => {
      requests.push([path, options.method || 'GET']);
      if (path.includes('?limit=100')) {
        return [{ id: 'message-1', timestamp: '2026-07-25T12:00:00Z' }];
      }
      return null;
    },
    now: () => new Date('2026-07-25T12:01:00Z'),
    logger: { info() {}, warn() {}, error() {} },
  });
  await worker.processChannel({ id: 'job-1' }, 'channel-1');
  assert.deepEqual(deletedFromIndex, ['message-1']);
  assert.equal(requests.some(([path, method]) => path.endsWith('/message-1') && method === 'DELETE'), true);
});

test('message index recalcula hash e embedding em criacao ou edicao', async () => {
  const saved = [];
  const service = createMessageIndexService({
    guildId: 'guild-1',
    embeddingModel: 'embed-test',
    embed: async ([content]) => [[content.length, 1]],
    repository: {
      upsertMessage: async (message) => saved.push(message),
      deleteMessages: async () => {},
    },
  });
  const first = await service.indexMessage({
    id: 'message-1', channelId: 'channel-1',
    author: { id: 'user-1', displayName: 'Membro' },
    content: 'primeira', timestamp: '2026-07-25T12:00:00Z',
  });
  const edited = await service.indexMessage({
    id: 'message-1', channelId: 'channel-1',
    author: { id: 'user-1', displayName: 'Membro' },
    content: 'editada', timestamp: '2026-07-25T12:00:00Z',
    editedTimestamp: '2026-07-25T12:01:00Z',
  });
  assert.notEqual(first.sourceHash, edited.sourceHash);
  assert.deepEqual(saved[1].embedding, [7, 1]);
  assert.equal(saved[1].embeddingStatus, 'ready');
});

test('validacao de IA cobre escopo, periodo e classificacao', () => {
  assert.throws(() => validateQueryInput({ prompt: 'teste', selectedTargets: [] }), /Selecione/);
  assert.throws(() => validateQueryInput({
    prompt: 'teste',
    selectedTargets: [{ id: 'channel-1', type: 'text' }],
    dateMode: 'range',
    dateFrom: '2026-07-26',
    dateTo: '2026-07-25',
  }), /data inicial/);
  const worker = createAiWorker({});
  assert.equal(worker.classify('Quando foi a ultima mensagem do usuario 123?'), 'factual');
  assert.equal(worker.classify('Analise o impacto nas casas e leis'), 'narrative');
  assert.equal(worker.classify('Cenas sobre traicao'), 'semantic');
});

test('chunking documental preserva sobreposicao controlada sem chunks vazios', () => {
  const service = createKnowledgeService({
    repository: {},
    embed: async () => [],
    storagePath: '.tmp/knowledge-test',
  });
  const chunks = service.chunkText(`${'A'.repeat(2_500)}. ${'B'.repeat(2_500)}.`);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.trim().length > 0));
});

test('novas rotas permanecem protegidas sem consultar banco', async () => {
  const app = createApp();
  for (const [method, path] of [
    ['post', '/api/cleanup/preview'],
    ['get', '/api/ai/queries'],
    ['get', '/api/knowledge/documents'],
  ]) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 401);
  }
});
