import { env } from '../config/env.mjs';

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ATTEMPTS = 3;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createHttpError(message, status, detail = null) {
  const error = new Error(message);
  error.status = status;
  error.detail = detail;
  return error;
}

function normalizePath(path) {
  return String(path || '').startsWith('/') ? path : `/${path}`;
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function retryDelay(response, body, attempt) {
  if (response.status === 429) {
    const retryAfter = Number(body?.retry_after || response.headers.get('retry-after') || 1);
    return Math.ceil(retryAfter * 1000) + 250;
  }
  return 700 * (attempt + 1);
}

function isPlainObject(value) {
  return value && typeof value === 'object' && value.constructor === Object;
}

export function assertDiscordConfig(options = {}) {
  if (!env.DISCORD_BOT_TOKEN) {
    throw createHttpError('DISCORD_BOT_TOKEN nao configurado.', 500);
  }

  if (options.requireGuild && !env.DISCORD_GUILD_ID) {
    throw createHttpError('DISCORD_GUILD_ID nao configurado.', 500);
  }
}

export async function discordRequest(path, options = {}) {
  assertDiscordConfig({ requireGuild: options.requireGuild === true });

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestOptions = { ...options };
  delete requestOptions.requireGuild;
  delete requestOptions.maxAttempts;
  delete requestOptions.timeoutMs;

  if (isPlainObject(requestOptions.body)) {
    requestOptions.body = JSON.stringify(requestOptions.body);
    requestOptions.headers = { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const headers = new Headers(requestOptions.headers || {});
    headers.set('Authorization', `Bot ${env.DISCORD_BOT_TOKEN}`);
    headers.set('User-Agent', 'BotConsoleMedieval (operator console, 0.1)');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${DISCORD_API_BASE_URL}${normalizePath(path)}`, {
        ...requestOptions,
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      const body = safeJsonParse(text);

      if (response.status === 429 || ([500, 502, 503, 504].includes(response.status) && attempt < maxAttempts - 1)) {
        await wait(retryDelay(response, body, attempt));
        continue;
      }

      if (!response.ok) {
        const friendlyMessages = {
          401: 'Token Discord invalido ou expirado.',
          403: 'Bot sem permissao para acessar este recurso no Discord.',
          404: 'Recurso Discord nao encontrado.',
        };
        const message = friendlyMessages[response.status] || body?.message || response.statusText || 'Erro ao consultar Discord.';
        throw createHttpError(message, response.status, body);
      }

      const remaining = Number(response.headers.get('x-ratelimit-remaining'));
      const resetAfter = Number(response.headers.get('x-ratelimit-reset-after'));
      if (remaining === 0 && resetAfter > 0) {
        await wait(Math.ceil(resetAfter * 1000) + 100);
      }

      return body;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw createHttpError('Tempo limite ao consultar Discord.', 504);
      }
      if (error.status) throw error;
      if (attempt < maxAttempts - 1) {
        await wait(700 * (attempt + 1));
        continue;
      }
      throw createHttpError('Falha de comunicacao com Discord.', 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw createHttpError('Discord indisponivel apos novas tentativas.', 502);
}

export function getBotUser() {
  return discordRequest('/users/@me');
}

export function getGuildInfo() {
  return discordRequest(`/guilds/${env.DISCORD_GUILD_ID}`, { requireGuild: true });
}

export async function getDiscordStatus() {
  assertDiscordConfig({ requireGuild: true });
  const [bot, guild] = await Promise.all([getBotUser(), getGuildInfo()]);
  const avatarExtension = String(bot.avatar || '').startsWith('a_') ? 'gif' : 'png';

  return {
    ok: true,
    bot: {
      id: bot.id,
      username: bot.username,
      discriminator: bot.discriminator,
      globalName: bot.global_name || null,
      avatar: bot.avatar || null,
      avatarUrl: bot.avatar
        ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.${avatarExtension}?size=128`
        : null,
      displayName: bot.global_name || bot.username,
    },
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.icon || null,
    },
    timestamp: new Date().toISOString(),
  };
}

export const discordService = {
  discordRequest,
  getBotUser,
  getGuildInfo,
  getDiscordStatus,
  assertDiscordConfig,
};
