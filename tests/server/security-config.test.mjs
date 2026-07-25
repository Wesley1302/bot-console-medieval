import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../server/src/app.mjs';
import { parseTrustProxy } from '../../server/src/config/env.mjs';

test('parseTrustProxy usa false quando nao ha proxy configurado', () => {
  assert.equal(parseTrustProxy(''), false);
  assert.equal(parseTrustProxy(undefined), false);
});

test('parseTrustProxy aceita loopback, hops e CIDR', () => {
  assert.equal(parseTrustProxy('loopback'), 'loopback');
  assert.equal(parseTrustProxy('1'), 1);
  assert.deepEqual(parseTrustProxy('127.0.0.1,10.0.0.0/8'), ['127.0.0.1', '10.0.0.0/8']);
});

test('parseTrustProxy rejeita valores arbitrarios', () => {
  assert.throws(() => parseTrustProxy('true'), /TRUST_PROXY invalido/);
  assert.throws(() => parseTrustProxy('proxy.example.com'), /TRUST_PROXY invalido/);
});

test('CORS permite origem local exata em desenvolvimento', async () => {
  const response = await request(createApp())
    .get('/api/health')
    .set('Origin', 'http://127.0.0.1:5173');
  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://127.0.0.1:5173');
});

test('CORS rejeita origem hostil', async () => {
  const response = await request(createApp())
    .get('/api/health')
    .set('Origin', 'https://origem-hostil.example');
  assert.equal(response.status, 500);
  assert.equal(response.body.error, true);
});
