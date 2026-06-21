import cors from 'cors';
import { env } from '../config/env.mjs';

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const selfOrigin = `http://${env.API_HOST}:${env.API_PORT}`;
const localPorts = new Set([String(env.API_PORT), '5173']);

function isLocalProjectOrigin(origin) {
  try {
    const url = new URL(origin);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) && localPorts.has(url.port);
  } catch {
    return false;
  }
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (
      !origin
      || origin === selfOrigin
      || (!env.IS_PRODUCTION && isLocalProjectOrigin(origin))
      || allowedOrigins.includes('*')
      || allowedOrigins.includes(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem nao permitida pelo CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
