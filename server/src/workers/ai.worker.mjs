import crypto from 'node:crypto';
import { env } from '../config/env.mjs';
import { aiRepository } from '../repositories/ai.repository.mjs';
import { knowledgeRepository } from '../repositories/knowledge.repository.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { scopeResolverService } from '../services/scope-resolver.service.mjs';
import { messageSyncService } from '../services/message-sync.service.mjs';
import { embedTexts, generateStructuredResponse } from '../services/embedding.service.mjs';
import { logger } from '../utils/logger.mjs';

const responseArrays = [
  'facts', 'interpretations', 'hypotheses', 'recommendations',
  'affectedHouses', 'lawsAndTraditions', 'limitations',
];

function classify(prompt) {
  const text = String(prompt).toLowerCase();
  if (/ultima|última|quando|data|mensagens? de|enviou/.test(text)) return 'factual';
  if (/impacto|analise|análise|casa|lei|tradi[cç][aã]o|recomenda/.test(text)) return 'narrative';
  return 'semantic';
}

function validateResult(result, answerType, evidenceIds) {
  if (!result || typeof result !== 'object' || typeof result.summary !== 'string') {
    throw new Error('O provedor retornou uma resposta estruturada invalida.');
  }
  const known = new Set(evidenceIds);
  const normalized = { ...result, answerType };
  for (const field of responseArrays) normalized[field] = Array.isArray(result[field]) ? result[field] : [];
  for (const field of responseArrays.slice(0, -1)) {
    normalized[field] = normalized[field].map((item) => ({
      ...item,
      evidenceIds: (item.evidenceIds || []).filter((id) => known.has(id)),
    }));
  }
  return normalized;
}

function evidenceFromMessage(message) {
  return {
    id: crypto.randomUUID(),
    sourceType: 'discord_message',
    sourceId: message.discordMessageId,
    excerpt: String(message.content || '').slice(0, 1_200),
    messageUrl: message.messageUrl,
    relevanceScore: Number(message.relevanceScore || 0),
    metadata: {
      messageId: message.discordMessageId,
      authorId: message.authorId,
      authorName: message.authorName,
      createdAt: message.createdAt,
      channelId: message.channelId,
      locationName: message.channelId,
    },
  };
}

function evidenceFromDocument(chunk) {
  return {
    id: crypto.randomUUID(),
    sourceType: 'knowledge_document',
    sourceId: String(chunk.id),
    excerpt: String(chunk.content || '').slice(0, 1_200),
    relevanceScore: Number(chunk.relevanceScore || 0),
    metadata: {
      documentId: chunk.documentId,
      title: chunk.title,
      section: chunk.section,
      page: chunk.page,
    },
  };
}

function extractAuthorId(prompt) {
  return String(prompt).match(/\b\d{16,22}\b/)?.[0] || null;
}

function boundedContext(prompt, answerType, evidence, maxCharacters) {
  const selected = [];
  for (const item of evidence) {
    const candidate = [...selected, {
      id: item.id,
      sourceType: item.sourceType,
      excerpt: item.excerpt,
      url: item.messageUrl,
      metadata: item.metadata,
    }];
    const serialized = JSON.stringify({ prompt, answerType, evidence: candidate });
    if (serialized.length > maxCharacters) break;
    selected.push(candidate.at(-1));
  }
  return JSON.stringify({ prompt, answerType, evidence: selected });
}

export function createAiWorker(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || aiRepository,
    messages: dependencies.messages || messageIndexRepository,
    knowledge: dependencies.knowledge || knowledgeRepository,
    resolver: dependencies.resolver || scopeResolverService,
    sync: dependencies.sync || messageSyncService,
    embed: dependencies.embed || embedTexts,
    generate: dependencies.generate || generateStructuredResponse,
    workerId: dependencies.workerId || `ai-${process.pid}`,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
    syncMaxPages: dependencies.syncMaxPages || env.AI_SYNC_MAX_PAGES_PER_AREA,
  };

  async function cancelled(queryId) {
    return Boolean((await deps.repository.getQuery(queryId))?.cancelRequestedAt);
  }

  async function processNext() {
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    const query = await deps.repository.claimNext(deps.workerId, staleBefore);
    if (!query) return false;
    const started = Date.now();
    try {
      const resolved = await deps.resolver.resolve(query.selectedTargetsJson);
      const areas = [...resolved.resolvedChannels, ...resolved.resolvedThreads];
      await deps.repository.updateProgress(
        query.id, 'syncing', 20, 'Sincronizando mensagens', { resolvedScope: resolved },
      );
      if (await cancelled(query.id)) {
        await deps.repository.finishCancelled(query.id);
        return true;
      }
      const syncResult = await deps.sync.syncResolvedScope(resolved, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        maxPages: deps.syncMaxPages,
        onPageComplete: () => deps.repository.heartbeat(query.id, deps.workerId),
        onAreaComplete: () => deps.repository.heartbeat(query.id, deps.workerId),
      });
      const partialSync = syncResult.truncatedAreas?.length > 0;
      for (const area of areas) {
        await deps.messages.upsertArea({ ...area, guildId: deps.guildId });
      }
      await deps.repository.saveScope(query.id, deps.guildId, `Consulta ${query.id}`, areas);

      const queryType = classify(query.prompt);
      await deps.repository.updateProgress(
        query.id, 'searching', 55, 'Buscando evidencias', { queryType },
      );
      const channelIds = areas.map((area) => area.id);
      let messageRows = [];
      if (queryType === 'factual' && extractAuthorId(query.prompt)) {
        const latest = await deps.messages.latestByAuthor({
          guildId: deps.guildId,
          channelIds,
          authorId: extractAuthorId(query.prompt),
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        });
        if (latest) messageRows = [latest];
      } else {
        const textRows = await deps.messages.searchText({
          guildId: deps.guildId,
          channelIds,
          query: query.prompt,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          limit: env.AI_MAX_EVIDENCES,
        });
        let semanticRows = [];
        if (env.EMBEDDING_MODEL) {
          const [embedding] = await deps.embed([query.prompt]).catch(() => []);
          semanticRows = await deps.messages.searchSemantic({
            guildId: deps.guildId,
            channelIds,
            embedding,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            limit: env.AI_MAX_EVIDENCES,
          });
        }
        messageRows = [...new Map(
          [...textRows, ...semanticRows].map((item) => [item.discordMessageId, item]),
        ).values()];
      }

      let documentRows = [];
      if (queryType !== 'factual') {
        documentRows = await deps.knowledge.searchText(query.prompt, Math.ceil(env.AI_MAX_EVIDENCES / 3));
        if (env.EMBEDDING_MODEL) {
          const [embedding] = await deps.embed([query.prompt]).catch(() => []);
          const semantic = await deps.knowledge.searchSemantic(
            embedding,
            Math.ceil(env.AI_MAX_EVIDENCES / 3),
          );
          documentRows = [...new Map(
            [...documentRows, ...semantic].map((item) => [String(item.id), item]),
          ).values()];
        }
      }

      const evidence = [
        ...messageRows.map(evidenceFromMessage),
        ...documentRows.map(evidenceFromDocument),
      ].slice(0, env.AI_MAX_EVIDENCES);
      await deps.repository.replaceEvidence(query.id, evidence);
      if (!evidence.length) {
        await deps.repository.complete(query.id, {
          summary: 'Nao encontrei evidencias suficientes nos locais e periodo selecionados.',
          answerType: queryType,
          facts: [], interpretations: [], hypotheses: [], recommendations: [],
          affectedHouses: [], lawsAndTraditions: [],
          limitations: ['Nenhuma evidencia recuperada.'],
        }, resolved.inaccessibleTargets.length || partialSync ? 'partial' : 'completed');
        return true;
      }
      if (queryType === 'factual' && extractAuthorId(query.prompt)) {
        const first = evidence[0];
        await deps.repository.complete(query.id, {
          summary: first
            ? `A evidencia mais recente foi enviada em ${first.metadata.createdAt}.`
            : 'Nao encontrei evidencias suficientes nos locais e periodo selecionados.',
          answerType: 'factual',
          facts: first ? [{
            statement: `${first.metadata.authorName} enviou a mensagem mais recente em ${first.metadata.createdAt}.`,
            evidenceIds: [first.id],
            confidence: 'high',
          }] : [],
          interpretations: [],
          hypotheses: [],
          recommendations: [],
          affectedHouses: [],
          lawsAndTraditions: [],
          limitations: first ? [] : ['Nenhuma evidencia recuperada.'],
          durationMs: Date.now() - started,
        }, resolved.inaccessibleTargets.length || partialSync ? 'partial' : 'completed');
        return true;
      }
      if (await cancelled(query.id)) {
        await deps.repository.finishCancelled(query.id);
        return true;
      }

      await deps.repository.updateProgress(query.id, 'analyzing', 80, 'Analisando evidencias');
      const contextLimit = env.AI_MAX_CONTEXT_TOKENS * 4;
      const system = [
        'Responda somente com JSON valido.',
        'Use apenas as evidencias fornecidas. Separe fatos, interpretacoes, hipoteses e recomendacoes.',
        'Nao invente personagens, casas, leis, mensagens ou links.',
        'Todo item deve referenciar apenas IDs de evidencias existentes.',
        'Preencha summary e as listas facts, interpretations, hypotheses, recommendations, affectedHouses, lawsAndTraditions e limitations.',
        'Cada item das listas analiticas deve ter statement, evidenceIds e confidence high, medium ou low.',
      ].join(' ');
      const request = boundedContext(query.prompt, queryType, evidence, contextLimit);
      const generated = await deps.generate(system, request);
      if (await cancelled(query.id)) {
        await deps.repository.finishCancelled(query.id);
        return true;
      }
      const result = validateResult(generated.result, queryType, evidence.map((item) => item.id));
      if (partialSync) {
        result.limitations.push(
          'A sincronizacao desta consulta foi limitada ao historico mais recente para responder mais rapido.',
        );
      }
      result.usage = generated.usage || null;
      result.model = generated.model || query.model || env.AI_MODEL;
      result.durationMs = Date.now() - started;
      await deps.repository.complete(
        query.id,
        result,
        resolved.inaccessibleTargets.length || partialSync ? 'partial' : 'completed',
      );
      logger.info('ai_query_completed', {
        queryId: query.id,
        queryType,
        evidenceCount: evidence.length,
        durationMs: result.durationMs,
        model: result.model,
        totalTokens: generated.usage?.total_tokens || null,
      });
    } catch (error) {
      await deps.repository.fail(query.id, error.message);
      logger.error('ai_query_failed', { queryId: query.id, status: error.status || 500 });
    }
    return true;
  }

  return { processNext, classify, validateResult };
}

export const aiWorker = createAiWorker();
