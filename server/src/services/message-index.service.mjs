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

  function normalizeMessage(message, embedding, embeddingStatus) {
    const content = String(message.content || '');
    return {
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
  }

  async function indexMessages(messages, options = {}) {
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) return [];

    const contents = list.map((message) => String(message.content || ''));
    const shouldEmbed = options.embed !== false;
    const embeddableIndexes = contents
      .map((content, index) => (
        shouldEmbed && content.trim() && deps.embeddingModel ? index : -1
      ))
      .filter((index) => index >= 0);
    let embeddings = [];
    let embeddingFailed = false;
    if (embeddableIndexes.length) {
      try {
        embeddings = await deps.embed(embeddableIndexes.map((index) => contents[index]));
        embeddingFailed = embeddings.length !== embeddableIndexes.length;
      } catch {
        embeddingFailed = true;
      }
    }

    const embeddingByIndex = new Map();
    if (!embeddingFailed) {
      embeddableIndexes.forEach((messageIndex, embeddingIndex) => {
        embeddingByIndex.set(messageIndex, embeddings[embeddingIndex] || null);
      });
    }

    const normalized = list.map((message, index) => {
      const embedding = embeddingByIndex.get(index) || null;
      const embeddingStatus = !contents[index].trim() || !deps.embeddingModel
        ? 'skipped'
        : (!shouldEmbed ? 'pending' : (embedding ? 'ready' : 'failed'));
      return normalizeMessage(message, embedding, embeddingStatus);
    });
    await Promise.all(normalized.map((message) => deps.repository.upsertMessage(message)));
    return normalized;
  }

  async function indexMessage(message) {
    const [normalized] = await indexMessages([message]);
    return normalized;
  }

  async function removeMessages(ids) {
    await deps.repository.deleteMessages(ids);
  }

  return { indexMessage, indexMessages, removeMessages, sourceHash };
}

export const messageIndexService = createMessageIndexService();
