import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deliveryNonce } from '../../server/src/utils/deliveryNonce.mjs';
import { createAutomationsService } from '../../server/src/services/automations.service.mjs';

async function withService(run, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bcm-automation-'));
  const timers = new Map();
  let timerId = 0;
  const now = options.now || (() => new Date('2026-07-25T12:00:00.000Z'));
  const sent = [];
  const messages = options.messages || {
    assertMessageableChannel: async () => ({ id: 'channel-1', name: 'qa' }),
    sendMessage: async (input) => {
      sent.push(input);
      return { ok: true, message: { id: `discord-${sent.length}` }, messages: [{ id: `discord-${sent.length}` }] };
    },
  };
  const service = createAutomationsService({
    root,
    messages,
    now,
    createId: (prefix) => `${prefix}_${Math.random().toString(16).slice(2)}`,
    setTimer: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimer: (id) => timers.delete(id),
    logger: { info() {}, warn() {}, error() {} },
  });
  try { await run({ service, root, timers, sent, messages }); } finally { await fs.rm(root, { recursive: true, force: true }); }
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Condicao de teste nao foi atingida.');
}

test('deliveryNonce e deterministico, curto e muda por chunk', () => {
  const first = deliveryNonce('automation_a', 'message_a', 0);
  assert.equal(first, deliveryNonce('automation_a', 'message_a', 0));
  assert.notEqual(first, deliveryNonce('automation_a', 'message_a', 1));
  assert.ok(first.length <= 25);
  assert.match(first, /^[a-f0-9]+$/);
});

test('pause durante envio reconcilia sucesso e nao reenvia no resume', async () => {
  let resolveSend;
  let calls = 0;
  const messages = {
    assertMessageableChannel: async () => ({ name: 'qa' }),
    sendMessage: () => { calls += 1; return new Promise((resolve) => { resolveSend = resolve; }); },
  };
  await withService(async ({ service }) => {
    const automation = await service.createAutomation({ channelId: 'channel-1', intervalSeconds: 5, messages: ['teste'] });
    const tick = service.runAutomationTick(automation.id);
    await waitFor(() => typeof resolveSend === 'function');
    await service.updateAutomationAction(automation.id, 'pause');
    resolveSend({ ok: true, message: { id: 'discord-1' }, messages: [{ id: 'discord-1' }] });
    await tick;
    assert.equal(automation.status, 'paused');
    assert.equal(automation.messages[0].status, 'sent');
    assert.equal(automation.currentIndex, 1);
    assert.equal(automation.nextRunAt, null);
    await service.updateAutomationAction(automation.id, 'resume');
    assert.equal(calls, 1);
  }, { messages });
});

test('cancel durante envio preserva sucesso confirmado sem agendar proxima', async () => {
  let resolveSend;
  const messages = {
    assertMessageableChannel: async () => ({ name: 'qa' }),
    sendMessage: () => new Promise((resolve) => { resolveSend = resolve; }),
  };
  await withService(async ({ service }) => {
    const automation = await service.createAutomation({ channelId: 'channel-1', intervalSeconds: 5, messages: ['teste'] });
    const tick = service.runAutomationTick(automation.id);
    await waitFor(() => typeof resolveSend === 'function');
    await service.updateAutomationAction(automation.id, 'cancel');
    resolveSend({ ok: true, message: { id: 'discord-1' }, messages: [{ id: 'discord-1' }] });
    await tick;
    assert.equal(automation.status, 'cancelled');
    assert.equal(automation.messages[0].status, 'sent');
    assert.deepEqual(automation.messages[0].discordMessageIds, ['discord-1']);
    assert.equal(automation.nextRunAt, null);
  }, { messages });
});

test('dois ticks simultaneos fazem uma unica chamada ao envio', async () => {
  let calls = 0;
  const messages = {
    assertMessageableChannel: async () => ({ name: 'qa' }),
    sendMessage: async () => { calls += 1; await new Promise((resolve) => setImmediate(resolve)); return { message: { id: 'discord-1' }, messages: [{ id: 'discord-1' }] }; },
  };
  await withService(async ({ service }) => {
    const automation = await service.createAutomation({ channelId: 'channel-1', intervalSeconds: 5, messages: ['teste'] });
    await Promise.all([service.runAutomationTick(automation.id), service.runAutomationTick(automation.id)]);
    assert.equal(calls, 1);
    assert.equal(automation.messages[0].status, 'sent');
  }, { messages });
});

test('restart normaliza sending para queued e reutiliza deliveryKey', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bcm-restart-'));
  const automation = {
    id: 'automation_restart', channelId: 'channel-1', mode: 'sequence', status: 'running', intervalSeconds: 5,
    currentIndex: 0, nextRunAt: null, messages: [{ id: 'message_restart', content: 'teste', status: 'sending', deliveryKey: 'automation_restart:message_restart' }],
  };
  await fs.writeFile(path.join(root, `${automation.id}.json`), JSON.stringify(automation));
  const sent = [];
  const service = createAutomationsService({ root, now: () => new Date('2026-07-25T12:00:00Z'), setTimer: () => 1, clearTimer() {}, logger: { info() {}, warn() {}, error() {} }, messages: { sendMessage: async (input) => { sent.push(input); return { message: { id: 'discord-existing' }, messages: [{ id: 'discord-existing' }] }; } } });
  try {
    await service.initAutomations();
    const loaded = service.getAutomation(automation.id);
    assert.equal(loaded.messages[0].status, 'queued');
    assert.equal(loaded.messages[0].deliveryKey, automation.messages[0].deliveryKey);
    await service.runAutomationTick(automation.id);
    assert.equal(sent[0].deliveryKey, automation.messages[0].deliveryKey);
    assert.equal(loaded.messages[0].status, 'sent');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
