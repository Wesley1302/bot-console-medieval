import assert from 'node:assert/strict';
import test from 'node:test';
import { createScopeResolver } from '../../server/src/services/scope-resolver.service.mjs';
import { createCleanupService } from '../../server/src/services/cleanup.service.mjs';
import { createCleanupWorker } from '../../server/src/workers/cleanup.worker.mjs';
import { createMessageIndexService } from '../../server/src/services/message-index.service.mjs';
import { createMessageSyncService } from '../../server/src/services/message-sync.service.mjs';
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
  let countedChannels;
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
        resolvedThreads: [{ id: 'thread-1', name: 'topico', type: 'thread' }],
        inaccessibleTargets: [],
        warnings: [],
      }),
    },
    index: {
      countByChannels: async (channelIds) => {
        countedChannels = channelIds;
        return 12;
      },
    },
    guildId: 'guild-1',
    now: () => new Date('2026-07-25T12:00:00Z'),
    randomUUID: () => 'preview-1',
    randomBytes: () => Buffer.from('abcd', 'hex'),
    logger: { info() {}, warn() {}, error() {} },
  });
  const preview = await service.preview({ targetType: 'category', targetId: 'cat-1', targetName: 'Casa' });
  assert.equal(preview.estimatedThreads, 1);
  assert.deepEqual(countedChannels, ['channel-1']);
  assert.deepEqual(preview.threadsToDelete.map((thread) => thread.id), ['thread-1']);
  assert.match(preview.warnings.at(-1), /excluidos por inteiro/);
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

test('worker exclui topicos inteiros ao limpar categoria, canal ou forum', async () => {
  const requests = [];
  const removedChannels = [];
  const pendingThreads = [{ threadId: 'thread-1', threadName: 'topico' }];
  const state = {
    status: 'running',
    lockedBy: 'worker-1',
    cancelRequestedAt: null,
    failedMessages: 0,
    failedThreads: 0,
    deletedThreads: 0,
  };
  const repository = {
    getJob: async () => state,
    addThreadItems: async (_jobId, threads) => {
      assert.deepEqual(threads.map((thread) => thread.id), ['thread-1']);
    },
    listPendingThreads: async () => pendingThreads.splice(0, 50),
    completeThread: async (_jobId, _threadId, status) => {
      if (status === 'deleted') state.deletedThreads += 1;
      if (status === 'failed') state.failedThreads += 1;
      return true;
    },
    finish: async (_jobId, status) => {
      state.status = status;
      return state;
    },
  };
  const worker = createCleanupWorker({
    repository,
    index: {
      deleteMessages: async () => {},
      deleteByChannels: async (ids) => removedChannels.push(...ids),
    },
    workerId: 'worker-1',
    discordRequest: async (path, options = {}) => {
      requests.push([path, options.method || 'GET']);
      return null;
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  await worker.run({
    id: 'job-1',
    targetType: 'forum',
    resolvedScopeJson: {
      resolvedChannels: [],
      resolvedThreads: [{ id: 'thread-1', name: 'topico', type: 'thread' }],
    },
  });

  assert.deepEqual(requests, [['/channels/thread-1', 'DELETE']]);
  assert.deepEqual(removedChannels, ['thread-1']);
  assert.equal(state.deletedThreads, 1);
  assert.equal(state.status, 'completed');
});

test('worker preserva a thread quando ela e o alvo direto da limpeza', async () => {
  const requests = [];
  const state = {
    status: 'running',
    lockedBy: 'worker-1',
    cancelRequestedAt: null,
    failedMessages: 0,
    failedThreads: 0,
  };
  const repository = {
    getJob: async () => state,
    listPendingItems: async () => [],
    heartbeat: async () => {},
    finish: async (_jobId, status) => {
      state.status = status;
      return state;
    },
  };
  const worker = createCleanupWorker({
    repository,
    index: { deleteMessages: async () => {} },
    workerId: 'worker-1',
    discordRequest: async (path, options = {}) => {
      requests.push([path, options.method || 'GET']);
      if (path.includes('/messages?')) return [];
      return null;
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  await worker.run({
    id: 'job-1',
    targetType: 'thread',
    resolvedScopeJson: {
      resolvedChannels: [],
      resolvedThreads: [{ id: 'thread-1', name: 'topico', type: 'thread' }],
    },
  });

  assert.equal(
    requests.some(([path, method]) => path === '/channels/thread-1' && method === 'DELETE'),
    false,
  );
  assert.equal(requests.some(([path]) => path.includes('/channels/thread-1/messages?')), true);
  assert.equal(state.status, 'completed');
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

test('message index gera embeddings em lote para uma pagina inteira', async () => {
  const saved = [];
  const embeddingCalls = [];
  const service = createMessageIndexService({
    guildId: 'guild-1',
    embeddingModel: 'embed-test',
    embed: async (contents) => {
      embeddingCalls.push(contents);
      return contents.map((content) => [content.length, 1]);
    },
    repository: {
      upsertMessage: async (message) => saved.push(message),
      deleteMessages: async () => {},
    },
  });

  const indexed = await service.indexMessages([
    {
      id: 'message-1', channelId: 'channel-1',
      author: { id: 'user-1', displayName: 'Membro' },
      content: 'primeira', timestamp: '2026-07-25T12:00:00Z',
    },
    {
      id: 'message-2', channelId: 'channel-1',
      author: { id: 'user-2', displayName: 'Outro' },
      content: 'segunda mensagem', timestamp: '2026-07-25T12:01:00Z',
    },
    {
      id: 'message-3', channelId: 'channel-1',
      author: { id: 'user-3', displayName: 'Sem texto' },
      content: '', timestamp: '2026-07-25T12:02:00Z',
    },
  ]);

  assert.deepEqual(embeddingCalls, [['primeira', 'segunda mensagem']]);
  assert.equal(indexed.length, 3);
  assert.equal(saved.length, 3);
  assert.deepEqual(indexed[1].embedding, [16, 1]);
  assert.equal(indexed[2].embeddingStatus, 'skipped');
});

test('message index permite sincronizacao rapida sem gerar embeddings', async () => {
  let embedCalled = false;
  const saved = [];
  const service = createMessageIndexService({
    guildId: 'guild-1',
    embeddingModel: 'embed-test',
    embed: async () => {
      embedCalled = true;
      return [];
    },
    repository: {
      upsertMessage: async (message) => saved.push(message),
      deleteMessages: async () => {},
    },
  });

  const indexed = await service.indexMessages([{
    id: 'message-1', channelId: 'channel-1',
    author: { id: 'user-1', displayName: 'Membro' },
    content: 'mensagem pesquisavel', timestamp: '2026-07-25T12:00:00Z',
  }], { embed: false });

  assert.equal(embedCalled, false);
  assert.equal(indexed[0].embeddingStatus, 'pending');
  assert.equal(saved[0].content, 'mensagem pesquisavel');
});

test('sincronizacao limita paginas, usa lote e renova heartbeat por pagina', async () => {
  const batches = [];
  const heartbeats = [];
  const syncMarkers = [];
  let page = 0;
  const service = createMessageSyncService({
    guildId: 'guild-1',
    repository: {
      getArea: async () => null,
      upsertArea: async () => {},
      markAreaSynced: async (...args) => syncMarkers.push(args),
    },
    messages: {
      listMessages: async () => {
        page += 1;
        return {
          messages: [{
            id: `message-${page}`,
            channelId: 'channel-1',
            content: `pagina ${page}`,
            timestamp: `2026-07-25T12:0${page}:00Z`,
          }],
          hasMore: true,
        };
      },
    },
    index: {
      indexMessages: async (messages) => batches.push(messages.map((message) => message.id)),
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  const result = await service.syncArea(
    { id: 'channel-1', name: 'canal', type: 'text' },
    {
      maxPages: 2,
      onPageComplete: (progress) => heartbeats.push(progress.pages),
    },
  );

  assert.deepEqual(batches, [['message-1'], ['message-2']]);
  assert.deepEqual(heartbeats, [1, 2]);
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, true);
  assert.equal(syncMarkers[0][2], false);
});

test('validacao de IA cobre escopo, periodo e classificacao', () => {
  assert.throws(() => validateQueryInput({ prompt: 'teste', selectedTargets: [] }), /Selecione/);
  assert.throws(() => validateQueryInput({
    prompt: 'teste',
    outputMode: 'invalid',
    selectedTargets: [{ id: 'channel-1', type: 'text' }],
  }), /Tipo de saida/);
  assert.throws(() => validateQueryInput({
    prompt: 'teste',
    selectedTargets: [{ id: 'channel-1', type: 'text' }],
    dateMode: 'range',
    dateFrom: '2026-07-26',
    dateTo: '2026-07-25',
  }), /data inicial/);
  assert.equal(validateQueryInput({
    prompt: 'Narre detalhadamente os acontecimentos.',
    outputMode: 'narration',
    selectedTargets: [{ id: 'channel-1', type: 'text' }],
  }).outputMode, 'narration');
  const worker = createAiWorker({});
  assert.equal(worker.classify('Quando foi a ultima mensagem do usuario 123?'), 'factual');
  assert.equal(worker.classify('Analise o impacto nas casas e leis'), 'narrative');
  assert.equal(worker.classify('Cenas sobre traicao'), 'semantic');
  assert.equal(worker.classifyDepth('Resuma isso em poucas palavras'), 'summary');
  assert.equal(worker.classifyDepth('Explique a situacao'), 'standard');
  assert.equal(
    worker.classifyDepth('Explique detalhadamente, com mais detalhes'),
    'detailed',
  );
  assert.equal(
    worker.classifyDepth('Nao faca um resumo; apresente uma analise completa'),
    'detailed',
  );
  assert.match(worker.buildSystemPrompt('summary'), /80 a 180 palavras/);
  assert.match(worker.buildSystemPrompt('detailed'), /700 a 1400 palavras/);
  assert.match(
    worker.buildSystemPrompt('standard', 'announcement'),
    /comunicado final pronto para Discord/,
  );
  assert.match(
    worker.buildSystemPrompt('detailed', 'narration'),
    /Nao invente dialogos, mortes, resultados de batalhas/,
  );
  assert.equal(
    worker.searchTerms('Qual o motivo de a ADM Quack ter feito isso?'),
    'motivo adm quack',
  );
});

test('validacao de IA preserva secoes narrativas e remove referencias desconhecidas', () => {
  const worker = createAiWorker({});
  const result = worker.validateResult({
    title: 'Analise detalhada',
    summary: 'Resumo validado.',
    sections: [{
      heading: 'Contexto',
      body: 'Explicacao baseada nas mensagens.',
      evidenceIds: ['evidence-1', 'unknown'],
    }],
    facts: [{
      statement: 'Fato confirmado.',
      evidenceIds: ['evidence-1', 'unknown'],
      confidence: 'high',
    }],
    limitations: ['  Fonte parcial.  ', null],
  }, 'narrative', 'detailed', ['evidence-1']);

  assert.equal(result.responseDepth, 'detailed');
  assert.equal(result.title, 'Analise detalhada');
  assert.deepEqual(result.sections[0].evidenceIds, ['evidence-1']);
  assert.deepEqual(result.facts[0].evidenceIds, ['evidence-1']);
  assert.deepEqual(result.limitations, ['Fonte parcial.']);
  assert.deepEqual(result.interpretations, []);
});

test('validacao de IA preserva texto final dos modos de escrita', () => {
  const worker = createAiWorker({});
  const result = worker.validateResult({
    title: 'Aviso importante',
    summary: 'Comunicado administrativo preparado.',
    content: '# Aviso importante\n\nRevise seus envios antes de publicar.',
    sections: [],
    facts: [{
      statement: 'A regra foi discutida pela administracao.',
      evidenceIds: ['evidence-1'],
      confidence: 'high',
    }],
  }, 'semantic', 'standard', ['evidence-1'], 'announcement');

  assert.equal(result.outputMode, 'announcement');
  assert.match(result.content, /^# Aviso importante/);
  assert.equal(result.responseDepth, 'standard');
  assert.deepEqual(result.facts[0].evidenceIds, ['evidence-1']);
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
