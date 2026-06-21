import { discordRequest } from './discord.service.mjs';
import { channelKind } from './channels.service.mjs';
import { getBotUser } from './discord.service.mjs';
import { env } from '../config/env.mjs';

const DISCORD_MESSAGE_MAX_LENGTH = 2000;
const MAX_FILES = 5;
const MEMBER_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const memberProfileCache = new Map();
let roleProfileCache = null;

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function messageableKind(kind) {
  return ['text', 'announcement', 'thread'].includes(kind);
}

function requireValue(value, message) {
  if (!String(value || '').trim()) throw createHttpError(message, 400);
}

function avatarExtension(hash) {
  return String(hash || '').startsWith('a_') ? 'gif' : 'png';
}

function buildAvatarUrl(userId, avatar, guildId = '') {
  if (!userId || !avatar) return null;
  if (String(avatar).startsWith('http')) return String(avatar);
  const extension = avatarExtension(avatar);
  if (guildId) return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${avatar}.${extension}?size=80`;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=80`;
}

async function getGuildMemberProfile(userId) {
  const id = String(userId || '');
  if (!id || !env.DISCORD_GUILD_ID) return null;

  const cached = memberProfileCache.get(id);
  if (cached && Date.now() - cached.cachedAt < MEMBER_CACHE_MAX_AGE_MS) return cached.profile;

  try {
    const member = await discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/members/${id}`, { requireGuild: true });
    const profile = {
      nick: member?.nick || null,
      avatar: member?.avatar || null,
    };
    memberProfileCache.set(id, { cachedAt: Date.now(), profile });
    return profile;
  } catch (error) {
    if ([403, 404].includes(error.status)) {
      memberProfileCache.set(id, { cachedAt: Date.now(), profile: null });
      return null;
    }
    throw error;
  }
}

async function loadMemberProfiles(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const profiles = new Map();
  const userIds = new Set();

  for (const message of list) {
    if (message.author?.id) userIds.add(String(message.author.id));
    for (const mention of message.mentions || []) {
      if (mention?.id) userIds.add(String(mention.id));
    }
  }

  await Promise.all([...userIds].map(async (userId) => {
    profiles.set(userId, await getGuildMemberProfile(userId));
  }));

  return profiles;
}

async function loadRoleProfiles() {
  if (roleProfileCache && Date.now() - roleProfileCache.cachedAt < MEMBER_CACHE_MAX_AGE_MS) return roleProfileCache.roles;

  try {
    const roles = await discordRequest(`/guilds/${env.DISCORD_GUILD_ID}/roles`, { requireGuild: true });
    const byId = new Map((Array.isArray(roles) ? roles : []).map((role) => [String(role.id), role]));
    roleProfileCache = { cachedAt: Date.now(), roles: byId };
    return byId;
  } catch {
    return new Map();
  }
}

async function enrichMessagesWithGuildMembers(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const [profiles, roleProfiles] = await Promise.all([loadMemberProfiles(list), loadRoleProfiles()]);

  return list.map((message) => normalizeMessage(message, profiles.get(String(message.author?.id || '')), profiles, roleProfiles));
}

export function normalizeMessage(message, memberProfile = null, mentionProfiles = new Map(), roleProfiles = new Map()) {
  const userId = message.author?.id ? String(message.author.id) : '';
  const serverName = memberProfile?.nick || message.member?.nick || null;
  const serverAvatar = memberProfile?.avatar || message.member?.avatar || null;

  return {
    id: String(message.id),
    channelId: String(message.channel_id || ''),
    author: {
      id: userId,
      username: message.author?.username || 'Usuario',
      globalName: message.author?.global_name || null,
      displayName: serverName || message.author?.global_name || message.author?.username || 'Usuario',
      serverName,
      bot: Boolean(message.author?.bot),
      avatar: message.author?.avatar || null,
      serverAvatar,
      serverAvatarUrl: buildAvatarUrl(userId, serverAvatar, env.DISCORD_GUILD_ID),
      avatarUrl: buildAvatarUrl(userId, message.author?.avatar || null),
    },
    content: message.content || '',
    timestamp: message.timestamp || null,
    editedTimestamp: message.edited_timestamp || null,
    attachments: (message.attachments || []).map((attachment) => ({
      id: String(attachment.id),
      filename: attachment.filename || 'arquivo',
      url: attachment.url || '',
      contentType: attachment.content_type || null,
      size: Number(attachment.size || 0),
    })),
    mentions: (message.mentions || []).map((mention) => {
      const mentionId = mention?.id ? String(mention.id) : '';
      const mentionProfile = mentionProfiles.get(mentionId);
      const mentionServerName = mentionProfile?.nick || mention.member?.nick || null;
      const mentionServerAvatar = mentionProfile?.avatar || mention.member?.avatar || null;

      return {
        id: mentionId,
        username: mention.username || 'Usuario',
        globalName: mention.global_name || null,
        displayName: mentionServerName || mention.global_name || mention.username || 'Usuario',
        serverName: mentionServerName,
        bot: Boolean(mention.bot),
        avatar: mention.avatar || null,
        serverAvatar: mentionServerAvatar,
        serverAvatarUrl: buildAvatarUrl(mentionId, mentionServerAvatar, env.DISCORD_GUILD_ID),
        avatarUrl: buildAvatarUrl(mentionId, mention.avatar || null),
      };
    }),
    roleMentions: (message.mention_roles || []).map((roleId) => {
      const id = String(roleId || '');
      const role = roleProfiles.get(id);
      return {
        id,
        type: 'role',
        name: role?.name || 'Cargo',
      };
    }),
    embeds: message.embeds || [],
    stickers: message.sticker_items || [],
    pinned: Boolean(message.pinned),
    type: Number(message.type || 0),
  };
}

function normalizeLimit(limit) {
  const parsed = Number(limit || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export async function listMessages(channelId, options = {}) {
  const limit = normalizeLimit(options.limit);
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.before) params.set('before', String(options.before));
  if (options.after) params.set('after', String(options.after));

  const messages = await discordRequest(`/channels/${channelId}/messages?${params.toString()}`);
  const normalizedMessages = await enrichMessagesWithGuildMembers(messages);

  return {
    channelId: String(channelId),
    messages: normalizedMessages.reverse(),
    hasMore: Array.isArray(messages) && messages.length === limit,
  };
}

export async function getChannelInfo(channelId) {
  requireValue(channelId, 'Canal obrigatorio.');
  const channel = await discordRequest(`/channels/${channelId}`);
  const kind = channelKind(channel.type);

  return {
    id: String(channel.id),
    name: String(channel.name || 'sem-nome'),
    type: kind,
    rawType: Number(channel.type),
    parentId: channel.parent_id ? String(channel.parent_id) : null,
    messageable: messageableKind(kind),
  };
}

export async function assertMessageableChannel(channelId) {
  const channelInfo = await getChannelInfo(channelId);
  if (!channelInfo.messageable) {
    throw createHttpError('Canais deste tipo não aceitam envio de mensagens nesta V1. Escolha um canal de texto ou tópico.', 400);
  }
  return channelInfo;
}

function validateMessageInput({ channelId, content, files }) {
  requireValue(channelId, 'Canal obrigatorio.');
  const text = String(content || '');
  const uploads = Array.isArray(files) ? files : [];

  if (uploads.length > MAX_FILES) {
    throw createHttpError('Envie no máximo 5 arquivos por mensagem.', 400);
  }

  if (!text.trim() && uploads.length === 0) {
    throw createHttpError('Digite uma mensagem ou anexe um arquivo.', 400);
  }

  return { text, uploads };
}

function splitMessageContent(content) {
  const text = String(content || '');
  if (text.length <= DISCORD_MESSAGE_MAX_LENGTH) return text ? [text] : [''];

  const chunks = [];
  let remaining = text;

  while (remaining.length > DISCORD_MESSAGE_MAX_LENGTH) {
    const slice = remaining.slice(0, DISCORD_MESSAGE_MAX_LENGTH);
    const lastPeriod = slice.lastIndexOf('.');
    const cutIndex = lastPeriod > 0 ? lastPeriod + 1 : DISCORD_MESSAGE_MAX_LENGTH;
    const chunk = remaining.slice(0, cutIndex).trim();

    chunks.push(chunk || remaining.slice(0, DISCORD_MESSAGE_MAX_LENGTH));
    remaining = remaining.slice(cutIndex).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendMessage({ channelId, content, files = [] }) {
  const { text, uploads } = validateMessageInput({ channelId, content, files });
  await assertMessageableChannel(channelId);

  const chunks = splitMessageContent(text);
  const results = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const includeFiles = chunkIndex === 0 ? uploads : [];

    if (includeFiles.length === 0) {
      results.push(await discordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: { content: chunk },
      }));
    } else {
      const form = new FormData();
      form.set('payload_json', JSON.stringify({ content: chunk }));
      for (const [index, file] of includeFiles.entries()) {
        form.set(`files[${index}]`, new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), file.originalname);
      }
      results.push(await discordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: form,
      }));
    }
  }

  const [profiles, roleProfiles] = await Promise.all([loadMemberProfiles(results), loadRoleProfiles()]);
  const normalizedMessages = results.map((result) => normalizeMessage(result, profiles.get(String(result.author?.id || '')), profiles, roleProfiles));

  return {
    ok: true,
    message: normalizedMessages.at(-1),
    messages: normalizedMessages,
  };
}

export function getMessage(channelId, messageId) {
  requireValue(channelId, 'Canal obrigatorio.');
  requireValue(messageId, 'Mensagem obrigatoria.');
  return discordRequest(`/channels/${channelId}/messages/${messageId}`);
}

export async function assertMessageBelongsToBot(channelId, messageId) {
  const [bot, original] = await Promise.all([getBotUser(), getMessage(channelId, messageId)]);
  if (String(original.author?.id || '') !== String(bot.id || '')) {
    throw createHttpError('Apenas mensagens enviadas pelo próprio bot podem ser editadas.', 403);
  }
  return original;
}

export async function editMessage({ channelId, messageId, content }) {
  requireValue(channelId, 'Canal obrigatorio.');
  requireValue(messageId, 'Mensagem obrigatoria.');
  const text = String(content || '').trim();
  if (!text) throw createHttpError('Mensagem vazia.', 400);
  if (text.length > DISCORD_MESSAGE_MAX_LENGTH) throw createHttpError('Edicao excede o limite de 2000 caracteres do Discord.', 400);

  await assertMessageBelongsToBot(channelId, messageId);
  const result = await discordRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: { content: text },
  });

  const [profiles, roleProfiles] = await Promise.all([loadMemberProfiles([result]), loadRoleProfiles()]);
  return { ok: true, message: normalizeMessage(result, profiles.get(String(result.author?.id || '')), profiles, roleProfiles) };
}

export async function deleteMessage({ channelId, messageId }) {
  requireValue(channelId, 'Canal obrigatorio.');
  requireValue(messageId, 'Mensagem obrigatoria.');
  try {
    await discordRequest(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
  } catch (error) {
    if (error.status === 403) {
      throw createHttpError('O bot não tem permissão para apagar esta mensagem.', 403);
    }
    throw error;
  }

  return {
    ok: true,
    deleted: {
      channelId: String(channelId),
      messageId: String(messageId),
    },
  };
}

export const messagesService = {
  normalizeMessage,
  listMessages,
  getChannelInfo,
  assertMessageableChannel,
  sendMessage,
  editMessage,
  deleteMessage,
  getMessage,
  assertMessageBelongsToBot,
};
