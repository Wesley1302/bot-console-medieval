import crypto from 'node:crypto';
import { env } from '../config/env.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { embedTexts } from './embedding.service.mjs';

function sourceHash(message) {
  return crypto.createHash('sha256').update(JSON.stringify({
    content: message.content || '',
    attachments: message.attachments || [],
    editedAt: message.editedTimestamp || message.editedAt || null,
  })).digest('hex');
}

export function createMessageIndexService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || messageIndexRepository,
    embed: dependencies.embed || embedTexts,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
    embeddingModel: dependencies.embeddingModel ?? env.EMBEDDING_MODEL,
  };

  async function indexMessage(message) {
    const content = String(message.content || '');
    let embedding = null;
    let embeddingStatus = 'skipped';
    if (content.trim() && deps.embeddingModel) {
      try {
        [embedding] = await deps.embed([content]);
        embeddingStatus = embedding ? 'ready' : 'failed';
      } catch {
        embeddingStatus = 'failed';
      }
    }
    const normalized = {
      id: String(message.id),
      guildId: deps.guildId,
      channelId: String(message.channelId || message.channel_id || ''),
      authorId: String(message.author?.id || message.authorId || ''),
      authorName: message.author?.displayName || message.author?.globalName
        || message.author?.username || message.authorName || 'Usuario',
      content,
      createdAt: message.timestamp || message.createdAt,
      editedAt: message.editedTimestamp || message.editedAt || null,
      messageUrl: `https://discord.com/channels/${deps.guildId}/${message.channelId || message.channel_id}/${message.id}`,
      attachments: message.attachments || [],
      sourceHash: sourceHash(message),
      embeddingStatus,
      embedding,
      embeddingModel: embedding ? deps.embeddingModel : null,
    };
    await deps.repository.upsertMessage(normalized);
    return normalized;
  }

  async function removeMessages(ids) {
    await deps.repository.deleteMessages(ids);
  }

  return { indexMessage, removeMessages, sourceHash };
}

export const messageIndexService = createMessageIndexService();
