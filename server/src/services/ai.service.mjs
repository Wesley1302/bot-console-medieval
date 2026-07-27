import crypto from 'node:crypto';
import { env } from '../config/env.mjs';
import { aiRepository } from '../repositories/ai.repository.mjs';
import { logger } from '../utils/logger.mjs';

const dateModes = new Set(['all', 'since', 'until', 'range']);
const targetTypes = new Set(['category', 'text', 'announcement', 'forum', 'thread']);
const outputModes = new Set(['analysis', 'announcement', 'narration']);
const terminalStatuses = new Set(['completed', 'partial', 'failed', 'cancelled']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validDate(value) {
  return value && Number.isFinite(new Date(value).getTime());
}

function publicQuery(query, evidence = undefined) {
  if (!query) return null;
  const safe = { ...query };
  delete safe.lockedAt;
  delete safe.lockedBy;
  if (evidence) safe.evidence = evidence;
  return safe;
}

export function validateQueryInput(input) {
  const prompt = String(input?.prompt || '').trim();
  const selectedTargets = Array.isArray(input?.selectedTargets) ? input.selectedTargets : [];
  const dateMode = String(input?.dateMode || 'all');
  const outputMode = String(input?.outputMode || 'analysis');
  if (!prompt) throw httpError('Escreva uma pergunta ou orientacao para a IA.');
  if (prompt.length > 12_000) throw httpError('A pergunta deve ter no maximo 12.000 caracteres.');
  if (!selectedTargets.length) throw httpError('Selecione ao menos um local do servidor.');
  if (!dateModes.has(dateMode)) throw httpError('Periodo invalido.');
  if (!outputModes.has(outputMode)) throw httpError('Tipo de saida invalido.');
  if (['since', 'range'].includes(dateMode) && !validDate(input.dateFrom)) {
    throw httpError('Informe a data inicial.');
  }
  if (['until', 'range'].includes(dateMode) && !validDate(input.dateTo)) {
    throw httpError('Informe a data final.');
  }
  if (dateMode === 'range' && new Date(input.dateFrom) > new Date(input.dateTo)) {
    throw httpError('A data inicial deve ser anterior a data final.');
  }
  const normalizedTargets = selectedTargets.map((target) => ({
    id: String(target?.id || '').trim(),
    type: String(target?.type || '').trim(),
    name: String(target?.name || target?.id || '').trim(),
  }));
  if (normalizedTargets.some((target) => !target.id || !targetTypes.has(target.type))) {
    throw httpError('A selecao contem um local invalido.');
  }
  return {
    prompt,
    outputMode,
    selectedTargets: normalizedTargets,
    dateMode,
    dateFrom: ['since', 'range'].includes(dateMode) ? new Date(input.dateFrom) : null,
    dateTo: ['until', 'range'].includes(dateMode) ? new Date(input.dateTo) : null,
  };
}

export function createAiService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || aiRepository,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
    model: dependencies.model ?? env.AI_MODEL,
    randomUUID: dependencies.randomUUID || crypto.randomUUID,
    logger: dependencies.logger || logger,
  };

  async function createQuery(input) {
    const validated = validateQueryInput(input);
    const query = await deps.repository.createQuery({
      id: deps.randomUUID(),
      guildId: deps.guildId,
      model: deps.model || null,
      ...validated,
    });
    deps.logger.info('ai_query_queued', {
      queryId: query.id,
      targetCount: validated.selectedTargets.length,
      dateMode: validated.dateMode,
    });
    return { queryId: query.id, status: query.status };
  }

  async function listQueries(limit) {
    return (await deps.repository.listQueries(limit)).map((query) => publicQuery(query));
  }

  async function getQuery(id) {
    const query = await deps.repository.getQuery(id);
    if (!query) throw httpError('Consulta nao encontrada.', 404);
    const evidence = terminalStatuses.has(query.status)
      ? await deps.repository.listEvidence(id)
      : [];
    return publicQuery(query, evidence);
  }

  async function cancelQuery(id) {
    const query = await deps.repository.cancel(id);
    if (!query) throw httpError('Consulta nao encontrada.', 404);
    deps.logger.info('ai_query_cancel_requested', { queryId: id });
    return publicQuery(query);
  }

  return { createQuery, listQueries, getQuery, cancelQuery };
}

export const aiService = createAiService();
