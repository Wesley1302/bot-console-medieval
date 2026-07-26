import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGeminiClient,
  parseStructuredJson,
} from '../../server/src/services/embedding.service.mjs';

function success(summary = 'ok') {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ summary }) }] } }],
    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('Gemini troca de modelo quando o primeiro retorna 429', async () => {
  const calls = [];
  const client = createGeminiClient({
    apiKey: 'test-key',
    baseUrl: 'https://example.test',
    models: ['quality', 'fallback'],
    limits: { quality: 4, fallback: 12 },
    cooldownMs: 60_000,
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('/quality:')) {
        return new Response(JSON.stringify({ error: { message: 'quota' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'retry-after': '60' },
        });
      }
      return success('fallback');
    },
  });

  const result = await client.generate('system', 'prompt');

  assert.equal(result.model, 'fallback');
  assert.equal(result.result.summary, 'fallback');
  assert.equal(calls.length, 2);
});

test('Gemini respeita o limite local e usa o proximo modelo', async () => {
  const calls = [];
  let currentTime = 10_000;
  const client = createGeminiClient({
    apiKey: 'test-key',
    baseUrl: 'https://example.test',
    models: ['quality', 'fallback'],
    limits: { quality: 1, fallback: 2 },
    now: () => currentTime,
    fetchImpl: async (url) => {
      calls.push(url);
      return success(url.includes('/quality:') ? 'quality' : 'fallback');
    },
  });

  const first = await client.generate('system', 'first');
  currentTime += 1;
  const second = await client.generate('system', 'second');

  assert.equal(first.model, 'quality');
  assert.equal(second.model, 'fallback');
  assert.equal(calls.length, 2);
});

test('Gemini tenta novamente quando acorda no limite do cooldown', async () => {
  let currentTime = 0;
  let recovering = false;
  let calls = 0;
  const client = createGeminiClient({
    apiKey: 'test-key',
    baseUrl: 'https://example.test',
    models: ['quality'],
    limits: { quality: 4 },
    cooldownMs: 60_000,
    now: () => currentTime,
    sleep: async (milliseconds) => {
      if (recovering) currentTime += Math.max(0, milliseconds - 1);
    },
    fetchImpl: async () => {
      calls += 1;
      if (recovering) return success('recovered');
      return new Response(JSON.stringify({ error: { message: 'quota' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'retry-after': '60' },
      });
    },
  });

  await assert.rejects(
    () => client.generate('system', 'prime cooldown'),
    (error) => error.status === 429,
  );

  recovering = true;
  const result = await client.generate('system', 'retry after cooldown');

  assert.equal(result.model, 'quality');
  assert.equal(result.result.summary, 'recovered');
  assert.equal(calls, 2);
});

test('Gemini nao mascara erro de autenticacao com fallback', async () => {
  let calls = 0;
  const client = createGeminiClient({
    apiKey: 'invalid',
    baseUrl: 'https://example.test',
    models: ['quality', 'fallback'],
    limits: { quality: 4, fallback: 12 },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  await assert.rejects(
    () => client.generate('system', 'prompt'),
    (error) => error.status === 401,
  );
  assert.equal(calls, 1);
});

test('parser aceita JSON cercado por markdown sem aceitar texto arbitrario', () => {
  assert.deepEqual(parseStructuredJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseStructuredJson('Resposta: {"ok":true}'), { ok: true });
  assert.throws(() => parseStructuredJson('sem json'), /JSON invalido/);
});
