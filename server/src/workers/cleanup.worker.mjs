import os from 'node:os';
import { cleanupRepository } from '../repositories/cleanup.repository.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { discordRequest } from '../services/discord.service.mjs';
import { logger } from '../utils/logger.mjs';

const RECENT_LIMIT_MS = 14 * 24 * 60 * 60 * 1000;
const STALE_LOCK_MS = 2 * 60 * 1000;

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function messageTimestamp(message) {
  if (message.timestamp) return new Date(message.timestamp).getTime();
  try {
    return Number(BigInt(message.id) >> 22n) + 1420070400000;
  } catch {
    return 0;
  }
}

export function createCleanupWorker(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || cleanupRepository,
    index: dependencies.index || messageIndexRepository,
    discordRequest: dependencies.discordRequest || discordRequest,
    now: dependencies.now || (() => new Date()),
    logger: dependencies.logger || logger,
    workerId: dependencies.workerId || `${os.hostname()}:${process.pid}:cleanup`,
  };

  async function control(jobId) {
    const job = await deps.repository.getJob(jobId);
    if (!job) return 'cancelled';
    if (job.cancelRequestedAt || job.status === 'cancelled') return 'cancelled';
    if (job.status === 'paused') return 'paused';
    if (job.status === 'running' && job.lockedBy !== deps.workerId) return 'lost';
    return 'running';
  }

  async function recordResult(job, channelId, ids, status, error = null) {
    await deps.repository.markItems(job.id, ids, status, error);
    const counters = {
      processed: ids.length,
      deleted: status === 'deleted' ? ids.length : 0,
      failed: status === 'failed' ? ids.length : 0,
      skipped: status === 'skipped' ? ids.length : 0,
    };
    await deps.repository.updateProgress(job.id, counters);
    if (status !== 'failed') await deps.index.deleteMessages(ids);
    deps.logger.info('Lote de limpeza processado.', {
      jobId: job.id,
      channelId,
      count: ids.length,
      status,
    });
  }

  async function deleteOne(job, channelId, messageId) {
    try {
      await deps.discordRequest(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
      await recordResult(job, channelId, [messageId], 'deleted');
    } catch (error) {
      if (error.status === 404) await recordResult(job, channelId, [messageId], 'skipped');
      else await recordResult(job, channelId, [messageId], 'failed', error.message);
    }
  }

  async function deleteRecentBatch(job, channelId, ids) {
    if (ids.length === 1) {
      await deleteOne(job, channelId, ids[0]);
      return;
    }
    try {
      await deps.discordRequest(`/channels/${channelId}/messages/bulk-delete`, {
        method: 'POST',
        body: { messages: ids },
      });
      await recordResult(job, channelId, ids, 'deleted');
    } catch {
      for (const id of ids) {
        if (await control(job.id) !== 'running') return;
        await deleteOne(job, channelId, id);
      }
    }
  }

  async function resumeQueuedItems(job, channelId) {
    for (;;) {
      if (await control(job.id) !== 'running') return;
      const items = await deps.repository.listPendingItems(job.id, channelId, 50);
      if (!items.length) return;
      for (const item of items) {
        if (await control(job.id) !== 'running') return;
        await deleteOne(job, channelId, item.messageId);
      }
    }
  }

  async function processChannel(job, channelId) {
    await resumeQueuedItems(job, channelId);
    let before = '';
    for (;;) {
      if (await control(job.id) !== 'running') return;
      const params = new URLSearchParams({ limit: '100' });
      if (before) params.set('before', before);
      const page = await deps.discordRequest(`/channels/${channelId}/messages?${params.toString()}`);
      const messages = Array.isArray(page) ? page : [];
      if (!messages.length) return;
      before = String(messages.at(-1).id);
      await deps.repository.addItems(job.id, channelId, messages);
      const threshold = deps.now().getTime() - RECENT_LIMIT_MS + 5 * 60 * 1000;
      const recent = messages.filter((message) => messageTimestamp(message) >= threshold);
      const old = messages.filter((message) => messageTimestamp(message) < threshold);
      for (const batch of chunks(recent, 100)) {
        if (await control(job.id) !== 'running') return;
        await deleteRecentBatch(job, channelId, batch.map((message) => String(message.id)));
      }
      for (const message of old) {
        if (await control(job.id) !== 'running') return;
        await deleteOne(job, channelId, String(message.id));
      }
      await deps.repository.heartbeat(job.id, deps.workerId);
      if (messages.length < 100) return;
    }
  }

  async function run(job) {
    const targets = [
      ...(job.resolvedScopeJson?.resolvedChannels || []),
      ...(job.resolvedScopeJson?.resolvedThreads || []),
    ];
    try {
      deps.logger.info('cleanup_job_started', { jobId: job.id, targets: targets.length });
      for (const target of targets) {
        const state = await control(job.id);
        if (state === 'paused') return;
        if (state === 'lost') return;
        if (state === 'cancelled') {
          await deps.repository.finish(job.id, 'cancelled');
          return;
        }
        await processChannel(job, String(target.id));
      }
      const current = await deps.repository.getJob(job.id);
      if (current?.status === 'paused') return;
      if (current?.lockedBy !== deps.workerId) return;
      if (current?.cancelRequestedAt || current?.status === 'cancelled') {
        await deps.repository.finish(job.id, 'cancelled');
        return;
      }
      const finalStatus = current?.failedMessages > 0 ? 'partial' : 'completed';
      await deps.repository.finish(job.id, finalStatus);
      deps.logger.info('cleanup_job_completed', {
        jobId: job.id,
        status: finalStatus,
        processedMessages: current?.processedMessages || 0,
        deletedMessages: current?.deletedMessages || 0,
      });
    } catch (error) {
      deps.logger.error('Job de limpeza falhou.', { jobId: job.id, reason: error.message });
      await deps.repository.finish(job.id, 'failed', error.message);
    }
  }

  async function processOnce() {
    const staleBefore = new Date(deps.now().getTime() - STALE_LOCK_MS);
    const job = await deps.repository.claimNext(deps.workerId, staleBefore);
    if (!job) return false;
    await run(job);
    return true;
  }

  return { processOnce, run, processChannel, constants: { RECENT_LIMIT_MS, STALE_LOCK_MS } };
}

export const cleanupWorker = createCleanupWorker();
