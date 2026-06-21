import { Router } from 'express';
import { env } from '../config/env.mjs';
import { optionalAuth } from '../middleware/auth.mjs';
import {
  createSessionToken,
  getCookieOptions,
  isPasswordValid,
} from '../services/auth.service.mjs';

export const authRouter = Router();

const attemptsByIp = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 5 * 60 * 1000;
const MAX_INVALID_ATTEMPTS = 5;

function operatorPayload() {
  return { id: 'operator', role: 'admin' };
}

function clientIp(request) {
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

function loginConfigReady() {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET);
}

function blockedAttempt(ip) {
  const record = attemptsByIp.get(ip);
  if (!record?.blockedUntil) return false;
  if (Date.now() >= record.blockedUntil) {
    attemptsByIp.delete(ip);
    return false;
  }
  return true;
}

function recordInvalidAttempt(ip) {
  const now = Date.now();
  const current = attemptsByIp.get(ip);
  const record = current && now - current.firstAttemptAt <= WINDOW_MS
    ? current
    : { count: 0, firstAttemptAt: now, blockedUntil: 0 };

  record.count += 1;
  if (record.count >= MAX_INVALID_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS;
  }
  attemptsByIp.set(ip, record);
}

authRouter.post('/api/auth/login', (request, response) => {
  if (!loginConfigReady()) {
    response.status(500).json({ error: true, message: 'Autenticacao nao configurada no servidor.' });
    return;
  }

  const ip = clientIp(request);
  if (blockedAttempt(ip)) {
    response.status(429).json({ error: true, message: 'Muitas tentativas. Tente novamente em alguns minutos.' });
    return;
  }

  if (!isPasswordValid(request.body?.password)) {
    recordInvalidAttempt(ip);
    response.status(401).json({ error: true, message: 'Senha inválida.' });
    return;
  }

  attemptsByIp.delete(ip);
  response.cookie(env.SESSION_COOKIE_NAME, createSessionToken(), getCookieOptions());
  response.json({ ok: true, operator: operatorPayload() });
});

authRouter.post('/api/auth/logout', (_request, response) => {
  response.clearCookie(env.SESSION_COOKIE_NAME, { ...getCookieOptions(), maxAge: 0 });
  response.json({ ok: true });
});

authRouter.get('/api/auth/me', optionalAuth, (request, response) => {
  if (!request.operator) {
    response.json({ authenticated: false, operator: null });
    return;
  }
  response.json({ authenticated: true, operator: operatorPayload() });
});
