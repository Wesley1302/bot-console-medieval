import { env } from '../config/env.mjs';
import { knowledgeRepository } from '../repositories/knowledge.repository.mjs';
import { knowledgeService } from '../services/knowledge.service.mjs';
import { logger } from '../utils/logger.mjs';

export function createKnowledgeWorker(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || knowledgeRepository,
    service: dependencies.service || knowledgeService,
    workerId: dependencies.workerId || `knowledge-${process.pid}`,
  };

  async function processNext() {
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const document = await deps.repository.claimNext(deps.workerId, staleBefore);
    if (!document) return false;
    try {
      logger.info('knowledge_job_started', { documentId: document.id });
      await deps.service.processDocument(document);
      logger.info('knowledge_job_completed', { documentId: document.id });
    } catch (error) {
      await deps.repository.markFailed(document.id, error.message);
      logger.error('knowledge_job_failed', { documentId: document.id, status: error.status || 500 });
    }
    return true;
  }

  return { processNext };
}

export const knowledgeWorker = createKnowledgeWorker({ workerId: `knowledge-${env.API_HOST}-${process.pid}` });
