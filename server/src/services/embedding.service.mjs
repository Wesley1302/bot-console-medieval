import { env } from '../config/env.mjs';

function httpError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertAiConfig({ embedding = false } = {}) {
  if (!env.AI_API_KEY) throw httpError('AI_API_KEY nao configurada.');
  if (embedding && !env.EMBEDDING_MODEL) throw httpError('EMBEDDING_MODEL nao configurado.');
  if (!embedding && !env.AI_MODEL) throw httpError('AI_MODEL nao configurado.');
}

async function aiRequest(path, body) {
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
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await new Promise((resolve) => setTimeout(
          resolve,
          retryAfter > 0 ? retryAfter * 1_000 : 800 * (attempt + 1),
        ));
        continue;
      }
      throw httpError(
        payload?.error?.message || 'Falha ao consultar o provedor de IA.',
        response.status,
      );
    } catch (error) {
      if (error.status) throw error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
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

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const payload = await aiRequest('/embeddings', {
    model: env.EMBEDDING_MODEL,
    input: texts,
  });
  return (payload.data || [])
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
}

export async function generateStructuredResponse(system, prompt) {
  const payload = await aiRequest('/chat/completions', {
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
  try {
    return { result: JSON.parse(content), usage: payload.usage || null };
  } catch {
    throw httpError('O provedor de IA retornou JSON invalido.', 502);
  }
}

export const embeddingService = {
  embedTexts,
  generateStructuredResponse,
};
