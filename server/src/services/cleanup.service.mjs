import crypto from 'node:crypto';
import { env } from '../config/env.mjs';
import { cleanupRepository } from '../repositories/cleanup.repository.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { scopeResolverService } from './scope-resolver.service.mjs';
import { logger } from '../utils/logger.mjs';

const PREVIEW_TTL_MS = 15 * 60 * 1000;
const destructiveTypes = new Set(['category', 'forum']);
const allowedActions = new Set(['cancel', 'pause', 'resume']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  const size = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const paddedLeft = Buffer.alloc(size);
  const paddedRight = Buffer.alloc(size);
  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);
  return crypto.timingSafeEqual(paddedLeft, paddedRight) && leftBuffer.length === rightBuffer.length;
}

function publicJob(job) {
  if (!job) return null;
  const safe = { ...job };
  delete safe.confirmationToken;
  delete safe.lockedAt;
  delete safe.lockedBy;
  return safe;
}

export function createCleanupService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || cleanupRepository,
    index: dependencies.index || messageIndexRepository,
    resolver: dependencies.resolver || scopeResolverService,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
    now: dependencies.now || (() => new Date()),
    randomUUID: dependencies.randomUUID || crypto.randomUUID,
    randomBytes: dependencies.randomBytes || crypto.randomBytes,
    logger: dependencies.logger || logger,
  };

  async function preview(input) {
    const targetType = String(input?.targetType || '').trim();
    const targetId = String(input?.targetId || '').trim();
    const targetName = String(input?.targetName || input?.name || targetId).trim();
    if (!['category', 'channel', 'text', 'announcement', 'forum', 'thread'].includes(targetType)) {
      throw httpError('Tipo de alvo invalido.');
    }
    if (!targetId) throw httpError('Alvo obrigatorio.');

    const normalizedType = targetType === 'channel' ? 'text' : targetType;
    const resolvedScope = await deps.resolver.resolve([
      { id: targetId, name: targetName, type: normalizedType },
    ]);
    const channelIds = [
      ...resolvedScope.resolvedChannels.map((item) => item.id),
      ...resolvedScope.resolvedThreads.map((item) => item.id),
    ];
    const estimatedMessages = await deps.index.countByChannels(channelIds);
    const token = deps.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(deps.now().getTime() + PREVIEW_TTL_MS);
    const warnings = [
      ...resolvedScope.warnings,
      'A quantidade e uma estimativa do indice local; o Discord sera consultado durante a execucao.',
      'A exclusao e irreversivel e remove texto, anexos, embeds e stickers.',
    ];
    const job = await deps.repository.createPreview({
      id: deps.randomUUID(),
      guildId: deps.guildId,
      targetType: normalizedType,
      targetId,
      targetName,
      resolvedScope,
      inaccessibleTargets: resolvedScope.inaccessibleTargets,
      warnings,
      estimatedMessages,
      confirmationTokenHash: tokenHash(token),
      expiresAt,
    });
    deps.logger.info('cleanup_preview_created', {
      jobId: job.id,
      targetType: normalizedType,
      targetId,
      resolvedTargets: channelIds.length,
      estimatedMessages,
    });

    return {
      previewId: job.id,
      target: { id: targetId, name: targetName, type: normalizedType },
      resolvedTargets: [
        ...resolvedScope.resolvedChannels,
        ...resolvedScope.resolvedThreads,
      ],
      estimatedMessages,
      inaccessibleTargets: resolvedScope.inaccessibleTargets,
      warnings,
      confirmationToken: token,
      confirmationText: destructiveTypes.has(normalizedType) ? `LIMPAR ${targetName}` : null,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async function createJob(input) {
    const previewId = String(input?.previewId || '').trim();
    const token = String(input?.confirmationToken || '').trim().toUpperCase();
    const job = await deps.repository.getJob(previewId);
    if (!job) throw httpError('Previa de limpeza nao encontrada.', 404);
    if (job.status !== 'awaiting_confirmation') throw httpError('Esta previa ja foi utilizada ou expirou.', 409);
    if (new Date(job.confirmationExpiresAt).getTime() <= deps.now().getTime()) {
      throw httpError('O token de confirmacao expirou. Gere uma nova previa.', 410);
    }
    if (!safeEqual(tokenHash(token), job.confirmationToken)) {
      throw httpError('Token de confirmacao invalido.');
    }
    if (destructiveTypes.has(job.targetType)) {
      const expected = `LIMPAR ${job.targetName}`;
      if (String(input?.confirmationText || '').trim() !== expected) {
        throw httpError(`Digite exatamente: ${expected}`);
      }
    }
    const confirmed = await deps.repository.confirmJob(previewId, {
      eventType: 'cleanup_confirmed',
      metadata: { targetType: job.targetType, targetId: job.targetId },
    });
    if (!confirmed) throw httpError('A previa nao esta mais disponivel.', 409);
    deps.logger.info('cleanup_job_queued', { jobId: previewId, targetType: job.targetType });
    return publicJob(confirmed);
  }

  async function listJobs() {
    return (await deps.repository.listJobs()).map(publicJob);
  }

  async function getJob(id) {
    const job = await deps.repository.getJob(String(id || ''));
    if (!job) throw httpError('Job de limpeza nao encontrado.', 404);
    return publicJob(job);
  }

  async function action(id, actionInput) {
    const actionName = String(actionInput || '');
    if (!allowedActions.has(actionName)) throw httpError('Acao invalida.');
    const job = await deps.repository.getJob(id);
    if (!job) throw httpError('Job de limpeza nao encontrado.', 404);
    if (actionName === 'pause' && !['queued', 'running'].includes(job.status)) {
      throw httpError('Apenas limpezas na fila ou em execucao podem ser pausadas.');
    }
    if (actionName === 'resume' && job.status !== 'paused') {
      throw httpError('Apenas limpezas pausadas podem ser retomadas.');
    }
    if (actionName === 'cancel' && ['completed', 'partial', 'failed', 'cancelled'].includes(job.status)) {
      throw httpError('A limpeza ja foi finalizada.');
    }
    const updated = await deps.repository.setAction(id, actionName);
    deps.logger.info('cleanup_job_action', { jobId: id, action: actionName });
    return publicJob(updated);
  }

  return { preview, createJob, listJobs, getJob, action, constants: { PREVIEW_TTL_MS } };
}

export const cleanupService = createCleanupService();
