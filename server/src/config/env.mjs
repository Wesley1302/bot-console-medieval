const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

export const env = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  API_PORT: Number(process.env.API_PORT || 8787),
  API_HOST: process.env.API_HOST || '127.0.0.1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:5173',
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
