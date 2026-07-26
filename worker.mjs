import 'dotenv/config';
import { env } from './server/src/config/env.mjs';
import { database } from './server/src/db/database.mjs';
import { cleanupWorker } from './server/src/workers/cleanup.worker.mjs';
import { aiWorker } from './server/src/workers/ai.worker.mjs';
import { knowledgeWorker } from './server/src/workers/knowledge.worker.mjs';
import { discordGatewayService } from './server/src/services/discord-gateway.service.mjs';
import { reconciliationService } from './server/src/services/reconciliation.service.mjs';
import { createWorkerRuntime } from './server/src/workers/worker-runtime.mjs';
import { logger } from './server/src/utils/logger.mjs';

if (!database.isConfigured()) {
  logger.error('worker_configuration_missing', { variable: 'DATABASE_URL' });
  process.exit(1);
}

let stopping = false;
const runtime = createWorkerRuntime({
  cleanup: () => cleanupWorker.processOnce(),
  ai: () => aiWorker.processNext(),
  knowledge: () => knowledgeWorker.processNext(),
  reconciliation: () => reconciliationService.run(100),
  pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
  reconciliationIntervalMs: env.RECONCILIATION_INTERVAL_MINUTES * 60_000,
  logger,
});

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  runtime.stop();
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
runtime.start();
