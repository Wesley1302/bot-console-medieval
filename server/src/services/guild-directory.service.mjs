import { discordRequest as productionDiscordRequest } from './discord.service.mjs';
import { env as productionEnv } from '../config/env.mjs';

const MEMBER_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_MEMBER_TTL_MS = 60 * 1000;
const ROLE_TTL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_MEMBER_REQUESTS = 5;

function createGuildDirectory({ discordRequest = productionDiscordRequest, guildId = productionEnv.DISCORD_GUILD_ID, clock = () => Date.now() } = {}) {
  const members = new Map();
  const roles = { expiresAt: 0, value: new Map(), promise: null };

  async function getMember(id) {
    const key = String(id || '');
    if (!key || !guildId) return null;
    const cached = members.get(key);
    if (cached && cached.expiresAt > clock()) return cached.profile;
    if (cached?.promise) return cached.promise;
    const promise = discordRequest(`/guilds/${guildId}/members/${key}`, { requireGuild: true })
      .then((member) => {
        const profile = { nick: member?.nick ?? null, avatar: member?.avatar ?? null };
        members.set(key, { profile, expiresAt: clock() + MEMBER_TTL_MS });
        return profile;
      })
      .catch((error) => {
        if ([403, 404].includes(error.status)) {
          members.set(key, { profile: null, expiresAt: clock() + NEGATIVE_MEMBER_TTL_MS });
          return null;
        }
        members.delete(key);
        throw error;
      });
    members.set(key, { promise, expiresAt: 0 });
    return promise;
  }

  async function getMembers(ids, inlineProfiles = new Map()) {
    const result = new Map();
    const missing = [];
    for (const id of new Set((ids || []).map(String))) {
      if (inlineProfiles.has(id)) result.set(id, inlineProfiles.get(id));
      else missing.push(id);
    }
    let cursor = 0;
    async function worker() {
      while (cursor < missing.length) {
        const id = missing[cursor++];
        result.set(id, await getMember(id));
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_MEMBER_REQUESTS, missing.length) }, worker));
    return result;
  }

  async function getRoles() {
    if (!guildId) return new Map();
    if (roles.expiresAt > clock()) return roles.value;
    if (roles.promise) return roles.promise;
    roles.promise = discordRequest(`/guilds/${guildId}/roles`, { requireGuild: true })
      .then((payload) => {
        roles.value = new Map((Array.isArray(payload) ? payload : []).map((role) => [String(role.id), role]));
        roles.expiresAt = clock() + ROLE_TTL_MS;
        return roles.value;
      })
      .catch((error) => { roles.expiresAt = 0; throw error; })
      .finally(() => { roles.promise = null; });
    return roles.promise;
  }

  async function searchMembers(query = '', limit = 25) {
    if (!guildId) return [];
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('query', query);
    const payload = await discordRequest(`/guilds/${guildId}/members${query ? '/search' : ''}?${params.toString()}`, { requireGuild: true });
    return Array.isArray(payload) ? payload : [];
  }

  function invalidate() { members.clear(); roles.expiresAt = 0; roles.value = new Map(); }

  return { getMember, getMembers, getRoles, searchMembers, invalidate, constants: { MEMBER_TTL_MS, NEGATIVE_MEMBER_TTL_MS, ROLE_TTL_MS, MAX_CONCURRENT_MEMBER_REQUESTS } };
}

export { createGuildDirectory };
export const guildDirectory = createGuildDirectory();
