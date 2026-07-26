import { env } from '../config/env.mjs';

const conservativeRpm = {
  'gemini-3.5-flash': 4,
  'gemini-3.6-flash': 4,
  'gemini-3.5-flash-lite': 12,
  'gemini-3.1-flash-lite': 12,
};

function httpError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertAiConfig({ embedding = false } = {}) {
  if (!env.AI_API_KEY) throw httpError('AI_API_KEY nao configurada.');
  if (embedding && !env.EMBEDDING_MODEL) throw httpError('EMBEDDING_MODEL nao configurado.');
  if (!embedding && !env.AI_MODELS.length) throw httpError('AI_MODELS nao configurado.');
}

function retryDelay(payload, response, fallback) {
  const retryInfo = payload?.error?.details?.find((detail) => (
    String(detail?.['@type'] || '').endsWith('RetryInfo')
  ));
  const duration = retryInfo?.retryDelay || response.headers.get('retry-after');
  const match = String(duration || '').match(/^([\d.]+)s?$/);
  return match ? Math.ceil(Number(match[1]) * 1_000) : fallback;
}

function usageFromGemini(payload) {
  const usage = payload?.usageMetadata;
  if (!usage) return null;
  return {
    prompt_tokens: usage.promptTokenCount || 0,
    completion_tokens: usage.candidatesTokenCount || 0,
    total_tokens: usage.totalTokenCount || 0,
  };
}

function geminiText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought)
    ?.map((part) => part.text || '')
    .join('')
    .trim();
}

export function parseStructuredJson(content) {
  const text = String(content || '').trim();
  const candidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
  ];
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(text.slice(objectStart, objectEnd + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Tenta a proxima representacao segura.
    }
  }
  throw httpError('O provedor de IA retornou JSON invalido.', 502);
}

export function createGeminiClient(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const wait = options.sleep || sleep;
  const apiKey = options.apiKey ?? env.AI_API_KEY;
  const baseUrl = String(options.baseUrl || env.AI_BASE_URL).replace(/\/$/, '');
  const models = options.models || env.AI_MODELS;
  const limits = options.limits || env.AI_MODEL_RPM_LIMITS;
  const cooldownMs = options.cooldownMs || env.AI_MODEL_COOLDOWN_MS;
  const histories = new Map();
  const cooldowns = new Map();

  function rpm(model) {
    return limits[model] || conservativeRpm[model] || 4;
  }

  function localDelay(model) {
    const current = now();
    const history = (histories.get(model) || []).filter((time) => current - time < 60_000);
    histories.set(model, history);
    if (history.length < rpm(model)) return 0;
    return Math.max(1, 60_000 - (current - history[0]));
  }

  function modelDelay(model) {
    return Math.max(localDelay(model), (cooldowns.get(model) || 0) - now(), 0);
  }

  function recordAttempt(model) {
    const history = histories.get(model) || [];
    history.push(now());
    histories.set(model, history);
  }

  async function request(model, action, body) {
    recordAttempt(model);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/models/${model}:${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      throw httpError(
        error.name === 'TimeoutError'
          ? 'Tempo limite ao consultar o provedor de IA.'
          : 'Falha de comunicacao com o provedor de IA.',
        error.name === 'TimeoutError' ? 504 : 502,
      );
    }
    const payload = await response.json().catch(() => null);
    if (response.ok) return payload;
    const error = httpError(
      payload?.error?.message || 'Falha ao consultar o provedor de IA.',
      response.status,
    );
    error.retryMs = retryDelay(payload, response, cooldownMs);
    throw error;
  }

  async function generate(system, prompt) {
    if (!apiKey || !models.length) assertAiConfig();
    let lastError = null;
    for (let cycle = 0; cycle < 2; cycle += 1) {
      let shortestDelay = Infinity;
      let attempted = false;
      for (const model of models) {
        const delay = modelDelay(model);
        if (delay > 0) {
          shortestDelay = Math.min(shortestDelay, delay);
          continue;
        }
        attempted = true;
        try {
          const payload = await request(model, 'generateContent', {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          });
          const content = geminiText(payload);
          if (!content) throw httpError('O provedor de IA retornou resposta vazia.', 502);
          return {
            result: parseStructuredJson(content),
            usage: usageFromGemini(payload),
            model,
          };
        } catch (error) {
          lastError = error;
          const fallbackAllowed = error.status === 404
            || error.status === 408
            || error.status === 429
            || error.status === 502
            || error.status === 503
            || error.status === 504
            || error.status >= 500;
          if (!fallbackAllowed) throw error;
          const delayMs = error.status === 429
            ? Math.max(error.retryMs || cooldownMs, cooldownMs)
            : Math.min(error.retryMs || 5_000, 10_000);
          cooldowns.set(model, now() + delayMs);
          shortestDelay = Math.min(shortestDelay, delayMs);
        }
      }
      if (cycle === 0 && Number.isFinite(shortestDelay)) {
        await wait(Math.min(Math.max(shortestDelay, attempted ? 250 : 1), 60_000));
        continue;
      }
      break;
    }
    throw lastError || httpError('Todos os modelos de IA estao temporariamente limitados.', 429);
  }

  async function embed(texts, model, dimensions) {
    if (!apiKey || !model) assertAiConfig({ embedding: true });
    const output = [];
    for (let index = 0; index < texts.length; index += 100) {
      const batch = texts.slice(index, index + 100);
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const payload = await request(model, 'batchEmbedContents', {
            requests: batch.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              outputDimensionality: dimensions,
            })),
          });
          output.push(...(payload.embeddings || []).map((item) => item.values || []));
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error.status !== 429 && error.status < 500) throw error;
          if (attempt < 2) await wait(Math.min(error.retryMs || 1_000 * (attempt + 1), 10_000));
        }
      }
      if (lastError) throw lastError;
    }
    return output;
  }

  return {
    generate,
    embed,
    getState: () => ({
      histories: new Map(histories),
      cooldowns: new Map(cooldowns),
    }),
  };
}

async function openAiCompatibleRequest(path, body) {
  assertAiConfig({ embedding: path === '/embeddings' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${env.AI_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) return payload;
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(retryDelay(payload, response, 800 * (attempt + 1)));
        continue;
      }
      throw httpError(payload?.error?.message || 'Falha ao consultar o provedor de IA.', response.status);
    } catch (error) {
      if (error.status) throw error;
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw httpError(
        error.name === 'TimeoutError'
          ? 'Tempo limite ao consultar o provedor de IA.'
          : 'Falha de comunicacao com o provedor de IA.',
        error.name === 'TimeoutError' ? 504 : 502,
      );
    }
  }
  throw httpError('Provedor de IA indisponivel apos novas tentativas.', 502);
}

const geminiClient = createGeminiClient();

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  if (env.AI_PROVIDER === 'gemini') {
    return geminiClient.embed(texts, env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSIONS);
  }
  const payload = await openAiCompatibleRequest('/embeddings', {
    model: env.EMBEDDING_MODEL,
    input: texts,
  });
  return (payload.data || [])
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
}

export async function generateStructuredResponse(system, prompt) {
  if (env.AI_PROVIDER === 'gemini') return geminiClient.generate(system, prompt);
  const payload = await openAiCompatibleRequest('/chat/completions', {
    model: env.AI_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  });
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw httpError('O provedor de IA retornou resposta vazia.', 502);
  return { result: parseStructuredJson(content), usage: payload.usage || null, model: env.AI_MODEL };
}

export const embeddingService = {
  embedTexts,
  generateStructuredResponse,
};
