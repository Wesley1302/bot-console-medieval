import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../server/src/app.mjs';
import {
  buildChannelTree,
  channelKind,
  mergeThreadsForParent,
  normalizeChannel,
} from '../../server/src/services/channels.service.mjs';
import { validateAutomationInput } from '../../server/src/services/automations.service.mjs';
import { buildExportData, renderMarkdown, renderText } from '../../server/src/services/exports.service.mjs';
import { normalizeMessage } from '../../server/src/services/messages.service.mjs';

test('channelKind cobre tipos Discord suportados', () => {
  assert.equal(channelKind(4), 'category');
  assert.equal(channelKind(2), 'voice');
  assert.equal(channelKind(13), 'voice');
  assert.equal(channelKind(5), 'announcement');
  assert.equal(channelKind(15), 'forum');
  assert.equal(channelKind(11), 'thread');
  assert.equal(channelKind(0), 'text');
});

test('normalizeChannel define flags coerentes para voz, forum e thread', () => {
  const voice = normalizeChannel({ id: 'voice', name: 'voz', type: 2 });
  const forum = normalizeChannel({ id: 'forum', name: 'forum', type: 15 });
  const thread = normalizeChannel({ id: 'thread', name: 'thread', type: 11, parent_id: 'forum', thread_metadata: { archived: true, locked: true } });
  assert.equal(voice.allowed, false);
  assert.equal(voice.messageable, false);
  assert.equal(forum.messageable, false);
  assert.equal(thread.messageable, true);
  assert.equal(thread.thread, true);
  assert.equal(thread.archived, true);
  assert.equal(thread.locked, true);
});

test('buildChannelTree ordena canais, agrupa sem categoria e separa voz/threads', () => {
  const tree = buildChannelTree([
    { id: 'voice', name: 'Voz', type: 2, position: 1 },
    { id: 'cat', name: 'Categoria', type: 4, position: 2 },
    { id: 'text-b', name: 'b', type: 0, parent_id: 'cat', position: 2 },
    { id: 'text-a', name: 'a', type: 0, parent_id: 'cat', position: 1 },
    { id: 'outside', name: 'fora', type: 0, position: 3 },
    { id: 'forum', name: 'Forum', type: 15, parent_id: 'cat', position: 4 },
  ], [
    { id: 'thread', name: 'Topico', type: 11, parent_id: 'forum' },
  ]);

  assert.equal(tree.categories[0].id, 'uncategorized');
  assert.deepEqual(tree.categories[0].channels.map((channel) => channel.id), ['outside']);
  assert.deepEqual(tree.categories[1].channels.map((channel) => channel.id), ['text-a', 'text-b', 'forum']);
  assert.equal(tree.activeThreads[0].id, 'thread');
  assert.equal(tree.categories.flatMap((category) => category.channels).some((channel) => channel.id === 'voice'), false);
});

test('buildChannelTree retorna grupo virtual para servidor sem categorias', () => {
  const tree = buildChannelTree([{ id: 'channel', name: 'geral', type: 0 }], []);
  assert.equal(tree.categories.length, 1);
  assert.equal(tree.categories[0].virtual, true);
  assert.equal(tree.categories[0].name, 'SEM CATEGORIA');
});

test('mergeThreadsForParent une topicos ativos e arquivados sem duplicar', () => {
  const threads = mergeThreadsForParent('parent-1', [
    [{ id: 'active', name: 'Ativo', type: 11, parent_id: 'parent-1' }],
    [
      {
        id: 'archived',
        name: 'Arquivado',
        type: 11,
        parent_id: 'parent-1',
        thread_metadata: { archived: true },
      },
      { id: 'other', name: 'Outro', type: 11, parent_id: 'parent-2' },
    ],
    [{ id: 'active', name: 'Ativo duplicado', type: 11, parent_id: 'parent-1' }],
  ]);

  assert.deepEqual(threads.map((thread) => thread.id), ['active', 'archived']);
  assert.equal(threads[1].archived, true);
});

test('normalizeMessage preserva identidade do servidor, anexos, mencoes e cargos', () => {
  const message = normalizeMessage({
    id: 'message-1',
    channel_id: 'channel-1',
    author: { id: 'user-1', username: 'real-user', global_name: 'Nome real', avatar: 'hash', bot: false },
    content: 'ola <@user-2> <@&role-1>',
    timestamp: '2026-07-25T12:00:00.000Z',
    edited_timestamp: '2026-07-25T12:01:00.000Z',
    mentions: [{ id: 'user-2', username: 'mention-user' }],
    mention_roles: ['role-1'],
    attachments: [{ id: 'file-1', filename: 'arquivo.txt', url: 'https://example.test/file', size: 12 }],
    sticker_items: [{ id: 'sticker-1', name: 'sticker' }],
  }, { nick: 'Nome no servidor', avatar: 'guild-avatar' }, new Map([
    ['user-2', { nick: 'Membro mencionado', avatar: 'mention-avatar' }],
  ]), new Map([
    ['role-1', { name: 'Conselho' }],
  ]));

  assert.equal(message.author.displayName, 'Nome no servidor');
  assert.equal(message.author.serverAvatar, 'guild-avatar');
  assert.equal(message.mentions[0].displayName, 'Membro mencionado');
  assert.equal(message.roleMentions[0].name, 'Conselho');
  assert.equal(message.editedTimestamp, '2026-07-25T12:01:00.000Z');
  assert.equal(message.attachments[0].filename, 'arquivo.txt');
  assert.equal(message.stickers[0].name, 'sticker');
});

test('normalizeMessage tolera autor e colecoes ausentes', () => {
  const message = normalizeMessage({ id: 'message-2', channel_id: 'channel-2' });
  assert.equal(message.author.username, 'Usuario');
  assert.deepEqual(message.attachments, []);
  assert.deepEqual(message.mentions, []);
  assert.deepEqual(message.roleMentions, []);
  assert.deepEqual(message.embeds, []);
  assert.deepEqual(message.stickers, []);
});

test('validateAutomationInput aceita sequencia/agendamento e rejeita limites', () => {
  const sequence = validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 5, messages: ['um', 'dois'] });
  assert.equal(sequence.intervalSeconds, 5);
  assert.equal(sequence.messages.length, 2);

  const scheduled = validateAutomationInput({
    mode: 'scheduled',
    channelId: 'channel-1',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    messages: ['agendada'],
  });
  assert.equal(scheduled.mode, 'scheduled');
  assert.equal(scheduled.intervalSeconds, 0);

  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 0, messages: ['x'] }), /Intervalo minimo/);
  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 1, messages: [] }), /ao menos uma/);
  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 1, messages: Array(101).fill('x') }), /maximo 100/);
});

test('validateAutomationInput rejeita payload ausente e canal vazio', () => {
  assert.throws(() => validateAutomationInput(null), /Payload obrigatorio/);
  assert.throws(() => validateAutomationInput({ intervalSeconds: 1, messages: ['x'] }), /Canal obrigatorio/);
});

test('validateAutomationInput rejeita intervalo infinito e agendamento sem data', () => {
  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: Infinity, messages: ['x'] }), /Intervalo obrigatorio/);
  assert.throws(() => validateAutomationInput({ mode: 'scheduled', channelId: 'channel-1', messages: ['x'] }), /Data e hora/);
});

test('validateAutomationInput rejeita agendamento passado e mensagens multiplas agendadas', () => {
  assert.throws(() => validateAutomationInput({ mode: 'scheduled', channelId: 'channel-1', scheduledAt: new Date(Date.now() - 1000).toISOString(), messages: ['x'] }), /futuro/);
  assert.throws(() => validateAutomationInput({ mode: 'scheduled', channelId: 'channel-1', scheduledAt: new Date(Date.now() + 3600000).toISOString(), messages: ['x', 'y'] }), /uma mensagem/);
});

test('validateAutomationInput rejeita mensagens vazias ou nao textuais', () => {
  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 1, messages: [''] }), /esta vazia/);
  assert.throws(() => validateAutomationInput({ channelId: 'channel-1', intervalSeconds: 1, messages: [42] }), /precisa ser texto/);
});

test('renderizadores de exportacao preservam conversas, autor e anexos', () => {
  const data = buildExportData({
    exportId: 'export_test',
    target: { id: 'channel-1', name: 'qa', type: 'text' },
    conversations: [{
      id: 'channel-1',
      name: 'qa',
      type: 'text',
      messages: [{
        id: 'message-1',
        timestamp: '2026-07-25T12:00:00.000Z',
        author: { serverName: 'Operador' },
        content: 'mensagem de teste',
        attachments: [{ filename: 'imagem.png', url: 'https://example.test/imagem.png' }],
      }],
    }],
    warnings: [],
    errors: [],
    createdAt: '2026-07-25T12:00:00.000Z',
  });

  assert.equal(data.summary.totalMessages, 1);
  assert.match(renderMarkdown(data), /Operador/);
  assert.match(renderMarkdown(data), /https:\/\/example\.test\/imagem\.png/);
  assert.match(renderText(data), /mensagem de teste/);
});

test('buildExportData calcula totais de conversas, erros e avisos', () => {
  const data = buildExportData({
    exportId: 'export_empty',
    target: { id: 'category-1', name: 'categoria', type: 'category' },
    conversations: [{ id: 'empty', name: 'vazio', type: 'text', messages: [] }],
    warnings: ['aviso'],
    errors: [{ channelId: 'bad', message: 'falhou' }],
    createdAt: '2026-07-25T12:00:00.000Z',
  });
  assert.deepEqual(data.summary, { totalConversations: 1, totalMessages: 0, totalErrors: 1, totalWarnings: 1 });
  assert.equal(data.conversations[0].messageCount, 0);
});

test('renderizadores informam conversa sem mensagens', () => {
  const data = buildExportData({
    exportId: 'export_empty',
    target: { id: 'channel-1', name: 'vazio', type: 'text' },
    conversations: [{ id: 'channel-1', name: 'vazio', type: 'text', messages: [] }],
    warnings: [],
    errors: [],
  });
  assert.match(renderMarkdown(data), /Nenhuma mensagem encontrada/);
  assert.match(renderText(data), /Nenhuma mensagem encontrada/);
});

test('contratos HTTP de health, auth/me e protecao permanecem estaveis', async () => {
  const app = createApp();
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);

  const me = await request(app).get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.authenticated, false);

  const protectedResponse = await request(app).get('/api/status');
  assert.equal(protectedResponse.status, 401);
  assert.equal(protectedResponse.body.message, 'Não autenticado.');

  const protectedThreads = await request(app).get('/api/channels/channel-1/threads');
  assert.equal(protectedThreads.status, 401);
  assert.equal(protectedThreads.body.message, 'Não autenticado.');
});

test('health rejeita uma rota operacional desconhecida sem quebrar o app', async () => {
  const response = await request(createApp()).get('/api/route-that-does-not-exist');
  assert.equal(response.status, 404);
});
