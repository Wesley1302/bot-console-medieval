import { env } from '../config/env.mjs';
import { discordRequest } from './discord.service.mjs';

export function channelKind(type) {
  if (type === 4) return 'category';
  if ([2, 13].includes(type)) return 'voice';
  if ([10, 11, 12].includes(type)) return 'thread';
  if ([5].includes(type)) return 'announcement';
  if ([15, 16].includes(type)) return 'forum';
  return 'text';
}

function messageableKind(kind) {
  return ['text', 'announcement', 'thread'].includes(kind);
}

function sortByPositionThenName(left, right) {
  const position = Number(left.position || 0) - Number(right.position || 0);
  if (position !== 0) return position;
  return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR');
}

function sortThreads(left, right) {
  if (left.archived !== right.archived) return left.archived ? 1 : -1;
  return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeChannel(channel, extra = {}) {
  const kind = channelKind(channel.type);
  const messageable = messageableKind(kind);

  return {
    id: String(channel.id),
    name: String(channel.name || 'sem-nome'),
    type: kind,
    rawType: Number(channel.type),
    parentId: channel.parent_id ? String(channel.parent_id) : null,
    position: Number(channel.position || 0),
    allowed: kind !== 'voice',
    messageable,
    thread: kind === 'thread',
    archived: Boolean(channel.thread_metadata?.archived),
    locked: Boolean(channel.thread_metadata?.locked),
    ownerId: channel.owner_id ? String(channel.owner_id) : null,
    lastMessageId: channel.last_message_id ? String(channel.last_message_id) : null,
    ...extra,
  };
}

export function listGuildChannels() {
  return discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/channels`, { requireGuild: true });
}

export async function listActiveThreads() {
  const payload = await discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/threads/active`, { requireGuild: true });
  return Array.isArray(payload?.threads) ? payload.threads : [];
}

export function buildChannelTree(channels, activeThreads) {
  const normalizedChannels = channels.map((channel) => normalizeChannel(channel));
  const categories = normalizedChannels
    .filter((channel) => channel.type === 'category')
    .sort(sortByPositionThenName);
  const nonCategories = normalizedChannels
    .filter((channel) => !['category', 'thread', 'voice'].includes(channel.type))
    .sort(sortByPositionThenName);

  const categoryGroups = categories.map((category) => ({
    ...category,
    channels: nonCategories.filter((channel) => channel.parentId === category.id),
  }));

  const categorizedIds = new Set(categoryGroups.flatMap((category) => category.channels.map((channel) => channel.id)));
  const uncategorized = nonCategories.filter((channel) => !channel.parentId || !categorizedIds.has(channel.id));
  const groups = [...categoryGroups];

  if (uncategorized.length || groups.length === 0) {
    groups.unshift({
      id: 'uncategorized',
      name: 'SEM CATEGORIA',
      type: 'category',
      virtual: true,
      channels: uncategorized.sort(sortByPositionThenName),
    });
  }

  return {
    guildId: env.DISCORD_GUILD_ID,
    categories: groups,
    activeThreads: activeThreads.map((thread) => normalizeChannel(thread)).sort(sortThreads),
  };
}

export async function listChannelsTree() {
  const [channels, activeThreads] = await Promise.all([listGuildChannels(), listActiveThreads()]);
  return buildChannelTree(channels, activeThreads);
}

async function listArchivedThreads(forumId, privacy) {
  const threads = [];
  const warnings = [];
  let before = '';

  for (;;) {
    const params = new URLSearchParams({ limit: '100' });
    if (before) params.set('before', before);

    try {
      const payload = await discordRequest(`/channels/${forumId}/threads/archived/${privacy}?${params.toString()}`);
      const page = Array.isArray(payload?.threads) ? payload.threads : [];
      threads.push(...page);
      if (!payload?.has_more || page.length === 0) break;
      before = page.at(-1)?.thread_metadata?.archive_timestamp || page.at(-1)?.archive_timestamp || '';
      if (!before) break;
    } catch (error) {
      if (privacy === 'private' && error.status === 403) {
        warnings.push('Sem permissao para listar topicos privados arquivados.');
        break;
      }
      throw error;
    }
  }

  return { threads, warnings };
}

export async function listForumThreads(forumId) {
  const activeThreads = (await listActiveThreads()).filter((thread) => String(thread.parent_id) === String(forumId));
  const publicArchived = await listArchivedThreads(forumId, 'public');
  const privateArchived = await listArchivedThreads(forumId, 'private');
  const byId = new Map();

  for (const thread of [...activeThreads, ...publicArchived.threads, ...privateArchived.threads]) {
    if (String(thread.parent_id) === String(forumId)) byId.set(String(thread.id), thread);
  }

  return {
    forumId: String(forumId),
    threads: [...byId.values()].map((thread) => normalizeChannel(thread)).sort(sortThreads),
    warnings: [...publicArchived.warnings, ...privateArchived.warnings],
  };
}

function normalizeMentionUser(member) {
  const user = member?.user || {};
  const id = user.id ? String(user.id) : '';
  const serverName = member?.nick || null;
  const displayName = serverName || user.global_name || user.username || 'Usuario';
  const avatarExtension = String(user.avatar || '').startsWith('a_') ? 'gif' : 'png';

  return {
    id,
    type: 'user',
    label: displayName,
    detail: user.username ? `@${user.username}` : 'usuario',
    value: `<@${id}>`,
    username: user.username || null,
    mention: `<@${id}>`,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.${avatarExtension}?size=64`
      : null,
    searchable: normalizeText(`${displayName} ${serverName || ''} ${user.global_name || ''} ${user.username || ''}`),
  };
}

function normalizeMentionRole(role) {
  const id = role.id ? String(role.id) : '';
  return {
    id,
    type: 'role',
    label: role.name || 'Cargo',
    detail: 'cargo',
    value: `<@&${id}>`,
    mention: `<@&${id}>`,
    color: Number(role.color || 0),
    searchable: normalizeText(role.name),
  };
}

export async function searchMentionTargets(query = '') {
  const term = normalizeText(query);
  const [membersPayload, rolesPayload] = await Promise.allSettled([
    term
      ? discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/members/search?${new URLSearchParams({ query: term, limit: '25' }).toString()}`, { requireGuild: true })
      : discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/members?limit=25`, { requireGuild: true }),
    discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/roles`, { requireGuild: true }),
  ]);

  const users = membersPayload.status === 'fulfilled'
    ? (Array.isArray(membersPayload.value) ? membersPayload.value : [])
      .map(normalizeMentionUser)
      .filter((item) => item.id && (!term || item.searchable.includes(term)))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      .slice(0, 20)
    : [];

  const roles = rolesPayload.status === 'fulfilled'
    ? (Array.isArray(rolesPayload.value) ? rolesPayload.value : [])
      .map(normalizeMentionRole)
      .filter((item) => item.id !== env.DISCORD_GUILD_ID && item.id && (!term || item.searchable.includes(term)))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      .slice(0, 20)
    : [];

  const special = [
    { id: 'here', type: 'special', label: '@here', detail: 'pessoas online', value: '@here', mention: '@here' },
    { id: 'everyone', type: 'special', label: '@everyone', detail: 'todos no servidor', value: '@everyone', mention: '@everyone' },
  ].filter((item) => !term || normalizeText(`${item.label} ${item.detail}`).includes(term));

  const cleanUsers = users.map(({ searchable, ...item }) => item);
  const cleanRoles = roles.map(({ searchable, ...item }) => item);

  return {
    query: String(query || ''),
    users: cleanUsers,
    roles: cleanRoles,
    special,
    results: [...cleanUsers, ...cleanRoles],
    warnings: [
      ...(membersPayload.status === 'rejected' ? ['Nao foi possivel listar usuarios. Verifique permissoes/intents do bot.'] : []),
      ...(rolesPayload.status === 'rejected' ? ['Nao foi possivel buscar cargos do servidor.'] : []),
    ],
  };
}

export const channelsService = {
  channelKind,
  normalizeChannel,
  listGuildChannels,
  listActiveThreads,
  buildChannelTree,
  listChannelsTree,
  listForumThreads,
  searchMentionTargets,
};
