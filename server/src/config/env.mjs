const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

function parseTrustProxy(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized === 'loopback') return 'loopback';
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const entries = normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length && entries.every((entry) => /^[0-9a-fA-F:.]+(?:\/\d{1,3})?$/.test(entry))) {
    return entries;
  }

  throw new Error('TRUST_PROXY invalido. Use loopback, um numero de hops ou uma lista CIDR.');
}

export { parseTrustProxy };

export const env = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  API_PORT: Number(process.env.API_PORT || 8787),
  API_HOST: process.env.API_HOST || '127.0.0.1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:5173',
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  SESSION_COOKIE_NAME: 'bcm_session',
  SESSION_MAX_AGE_MS: 28_800_000,
  NODE_ENV,
  IS_PRODUCTION,
};

if (env.IS_PRODUCTION && (!env.ADMIN_PASSWORD || !env.SESSION_SECRET)) {
  throw new Error('ADMIN_PASSWORD e SESSION_SECRET devem ser configurados em producao.');
}

if (env.IS_PRODUCTION && env.CORS_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
  throw new Error('CORS_ORIGIN=* nao e permitido em producao.');
}
