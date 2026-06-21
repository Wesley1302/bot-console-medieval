import { env } from '../config/env.mjs';
import { parseCookies, verifySessionToken } from '../services/auth.service.mjs';

function readSession(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies[env.SESSION_COOKIE_NAME];
  const result = verifySessionToken(token);
  if (!result.valid) return null;
  return { id: 'operator' };
}

export function requireAuth(request, response, next) {
  const operator = readSession(request);
  if (!operator) {
    response.status(401).json({ error: true, message: 'Não autenticado.' });
    return;
  }
  request.operator = operator;
  next();
}

export function optionalAuth(request, _response, next) {
  const operator = readSession(request);
  if (operator) request.operator = operator;
  next();
}
