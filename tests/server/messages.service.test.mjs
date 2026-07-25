import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessageForm, buildMessagePayload } from '../../server/src/services/messages.service.mjs';

test('payload JSON inclui nonce idempotente apenas quando solicitado', () => {
  const payload = buildMessagePayload('texto', { parse: ['users'] }, 'nonce-123');
  assert.deepEqual(payload, { content: 'texto', allowed_mentions: { parse: ['users'] }, nonce: 'nonce-123', enforce_nonce: true });
  assert.deepEqual(buildMessagePayload('manual'), { content: 'manual' });
});

test('multipart preserva payload_json e arquivo sem definir Content-Type manualmente', async () => {
  const form = buildMessageForm({ content: 'anexo', nonce: 'nonce-1', enforce_nonce: true }, [{
    buffer: Buffer.from('arquivo'),
    mimetype: 'text/plain',
    originalname: 'teste.txt',
  }]);
  assert.deepEqual(JSON.parse(await form.get('payload_json')), { content: 'anexo', nonce: 'nonce-1', enforce_nonce: true });
  assert.equal(form.get('files[0]').name, 'teste.txt');
  assert.equal(form.get('files[0]').type, 'text/plain');
});
