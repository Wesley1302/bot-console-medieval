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
  DATABASE_URL: process.env.DATABASE_URL || '',
  DATABASE_SSL: String(process.env.DATABASE_SSL || '').toLowerCase() === 'true',
  DATABASE_POOL_SIZE: Math.max(1, Number(process.env.DATABASE_POOL_SIZE || 10)),
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai-compatible',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_BASE_URL: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  AI_MODEL: process.env.AI_MODEL || '',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || '',
  KNOWLEDGE_STORAGE_PATH: process.env.KNOWLEDGE_STORAGE_PATH || 'server/knowledge',
  JOB_CONCURRENCY: Math.max(1, Number(process.env.JOB_CONCURRENCY || 2)),
  MESSAGE_SYNC_CONCURRENCY: Math.max(1, Number(process.env.MESSAGE_SYNC_CONCURRENCY || 3)),
  RECONCILIATION_INTERVAL_MINUTES: Math.max(5, Number(process.env.RECONCILIATION_INTERVAL_MINUTES || 60)),
  AI_MAX_EVIDENCES: Math.max(1, Number(process.env.AI_MAX_EVIDENCES || 30)),
  AI_MAX_CONTEXT_TOKENS: Math.max(1000, Number(process.env.AI_MAX_CONTEXT_TOKENS || 24000)),
  DISCORD_GATEWAY_ENABLED: String(process.env.DISCORD_GATEWAY_ENABLED || '').toLowerCase() === 'true',
  WORKER_POLL_INTERVAL_MS: Math.max(500, Number(process.env.WORKER_POLL_INTERVAL_MS || 1500)),
  SESSION_COOKIE_NAME: 'bcm_session',
  SESSION_MAX_AGE_MS: 28_800_000,
  NODE_ENV,
  IS_PRODUCTION,
};

export function getAdvancedConfigurationStatus() {
  const database = Boolean(env.DATABASE_URL);
  const aiMissing = [
    ['AI_API_KEY', env.AI_API_KEY],
    ['AI_MODEL', env.AI_MODEL],
    ['EMBEDDING_MODEL', env.EMBEDDING_MODEL],
  ].filter(([, value]) => !value).map(([name]) => name);
  return {
    database,
    cleanup: database,
    knowledge: database,
    ai: database && aiMissing.length === 0,
    missing: [
      ...(!database ? ['DATABASE_URL'] : []),
      ...aiMissing,
    ],
  };
}

if (env.IS_PRODUCTION && (!env.ADMIN_PASSWORD || !env.SESSION_SECRET)) {
  throw new Error('ADMIN_PASSWORD e SESSION_SECRET devem ser configurados em producao.');
}

if (env.IS_PRODUCTION && env.CORS_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
  throw new Error('CORS_ORIGIN=* nao e permitido em producao.');
}
