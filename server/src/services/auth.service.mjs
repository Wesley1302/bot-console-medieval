import crypto from 'node:crypto';
import { env } from '../config/env.mjs';

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payloadBase64) {
  return crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken() {
  const now = Date.now();
  const payload = {
    sub: 'operator',
    iat: now,
    exp: now + env.SESSION_MAX_AGE_MS,
  };
  const payloadBase64 = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token) {
  if (!env.SESSION_SECRET) return { valid: false, reason: 'missing_secret' };
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing_token' };

  const [payloadBase64, signature, extra] = token.split('.');
  if (!payloadBase64 || !signature || extra) return { valid: false, reason: 'malformed_token' };

  const expectedSignature = sign(payloadBase64);
  if (!safeEqualText(signature, expectedSignature)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadBase64));
    if (payload.sub !== 'operator') return { valid: false, reason: 'invalid_subject' };
    if (!Number.isFinite(payload.exp) || Date.now() >= payload.exp) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }
}

export function isPasswordValid(inputPassword) {
  if (!env.ADMIN_PASSWORD) return false;
  const inputHash = crypto.createHash('sha256').update(String(inputPassword || '')).digest();
  const adminHash = crypto.createHash('sha256').update(env.ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(inputHash, adminHash);
}

export function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.IS_PRODUCTION,
    path: '/',
    maxAge: env.SESSION_MAX_AGE_MS,
  };
}

export function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}
