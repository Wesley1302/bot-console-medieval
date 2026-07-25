import 'dotenv/config';
import { env } from './server/src/config/env.mjs';
import { database } from './server/src/db/database.mjs';
import { cleanupWorker } from './server/src/workers/cleanup.worker.mjs';
import { aiWorker } from './server/src/workers/ai.worker.mjs';
import { knowledgeWorker } from './server/src/workers/knowledge.worker.mjs';
import { discordGatewayService } from './server/src/services/discord-gateway.service.mjs';
import { reconciliationService } from './server/src/services/reconciliation.service.mjs';
import { logger } from './server/src/utils/logger.mjs';

if (!database.isConfigured()) {
  logger.error('worker_configuration_missing', { variable: 'DATABASE_URL' });
  process.exit(1);
}

let stopping = false;
let lastReconciliation = 0;

async function tick() {
  if (stopping) return;
  try {
    const [cleanup, ai, knowledge] = await Promise.all([
      cleanupWorker.processOnce(),
      aiWorker.processNext(),
      knowledgeWorker.processNext(),
    ]);
    const reconciliationInterval = env.RECONCILIATION_INTERVAL_MINUTES * 60_000;
    if (Date.now() - lastReconciliation >= reconciliationInterval) {
      lastReconciliation = Date.now();
      const result = await reconciliationService.run(100);
      logger.info('reconciliation_completed', result);
    }
    if (!cleanup && !ai && !knowledge) {
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
    }
  } catch (error) {
    logger.error('worker_tick_failed', { status: error.status || 500, message: error.message });
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS * 2));
  }
  setImmediate(tick);
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info('worker_stopping', { signal });
  discordGatewayService.stop();
  await database.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error('worker_uncaught_exception', { message: error.message });
  shutdown('uncaughtException');
});

discordGatewayService.start();
logger.info('persistent_worker_started', { concurrency: env.JOB_CONCURRENCY });
tick();
