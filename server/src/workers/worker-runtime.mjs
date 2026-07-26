function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createWorkerRuntime(dependencies = {}) {
  const deps = {
    cleanup: dependencies.cleanup,
    ai: dependencies.ai,
    knowledge: dependencies.knowledge,
    reconciliation: dependencies.reconciliation,
    pollIntervalMs: dependencies.pollIntervalMs,
    reconciliationIntervalMs: dependencies.reconciliationIntervalMs,
    sleep: dependencies.sleep || wait,
    logger: dependencies.logger,
  };
  let stopping = false;
  let started = false;
  const loops = [];

  async function queueLoop(name, processNext) {
    while (!stopping) {
      try {
        const processed = await processNext();
        if (!processed && !stopping) await deps.sleep(deps.pollIntervalMs);
      } catch (error) {
        deps.logger.error('worker_queue_failed', {
          queue: name,
          status: error.status || 500,
          message: error.message,
        });
        if (!stopping) await deps.sleep(deps.pollIntervalMs * 2);
      }
    }
  }

  async function reconciliationLoop() {
    while (!stopping) {
      try {
        const result = await deps.reconciliation();
        deps.logger.info('reconciliation_completed', result);
      } catch (error) {
        deps.logger.error('worker_reconciliation_failed', {
          status: error.status || 500,
          message: error.message,
        });
      }
      if (!stopping) await deps.sleep(deps.reconciliationIntervalMs);
    }
  }

  function start() {
    if (started) return;
    started = true;
    loops.push(
      queueLoop('cleanup', deps.cleanup),
      queueLoop('ai', deps.ai),
      queueLoop('knowledge', deps.knowledge),
      reconciliationLoop(),
    );
  }

  function stop() {
    stopping = true;
  }

  async function waitForStop() {
    await Promise.allSettled(loops);
  }

  return { start, stop, waitForStop };
}
