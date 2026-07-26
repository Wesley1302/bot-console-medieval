import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerRuntime } from '../../server/src/workers/worker-runtime.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitUntil(predicate, timeoutMs = 250) {
  const expiresAt = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= expiresAt) throw new Error('Condicao do teste nao foi atingida.');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test('consulta de IA longa nao bloqueia o ciclo de limpezas', async () => {
  const aiStarted = deferred();
  const releaseAi = deferred();
  const releaseReconciliation = deferred();
  let cleanupCalls = 0;
  const runtime = createWorkerRuntime({
    cleanup: async () => {
      cleanupCalls += 1;
      return false;
    },
    ai: async () => {
      aiStarted.resolve();
      await releaseAi.promise;
      return true;
    },
    knowledge: async () => false,
    reconciliation: async () => {
      await releaseReconciliation.promise;
      return {};
    },
    pollIntervalMs: 1,
    reconciliationIntervalMs: 1,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    logger: { info() {}, error() {} },
  });

  runtime.start();
  await aiStarted.promise;
  await waitUntil(() => cleanupCalls >= 2);
  runtime.stop();
  releaseAi.resolve();
  releaseReconciliation.resolve();
  await runtime.waitForStop();

  assert.ok(cleanupCalls >= 2);
});
