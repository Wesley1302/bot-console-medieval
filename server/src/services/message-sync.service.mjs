import { env } from '../config/env.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { messagesService } from './messages.service.mjs';
import { messageIndexService } from './message-index.service.mjs';
import { logger } from '../utils/logger.mjs';

function inPeriod(timestamp, dateFrom, dateTo) {
  const value = timestamp ? new Date(timestamp).getTime() : 0;
  return (!dateFrom || value >= new Date(dateFrom).getTime())
    && (!dateTo || value <= new Date(dateTo).getTime());
}

function snowflakeAfter(timestamp) {
  if (!timestamp) return null;
  const milliseconds = new Date(timestamp).getTime();
  if (!Number.isFinite(milliseconds)) return null;
  return String(BigInt(Math.max(milliseconds + 1 - 1420070400000, 0)) << 22n);
}

async function mapLimit(items, concurrency, task) {
  const queue = [...items];
  const results = [];
  async function consume() {
    while (queue.length) {
      const item = queue.shift();
      results.push(await task(item));
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(Math.max(concurrency, 1), Math.max(items.length, 1)) },
    consume,
  ));
  return results;
}

export function createMessageSyncService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || messageIndexRepository,
    messages: dependencies.messages || messagesService,
    index: dependencies.index || messageIndexService,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
    concurrency: dependencies.concurrency || env.MESSAGE_SYNC_CONCURRENCY,
    logger: dependencies.logger || logger,
  };

  async function syncArea(area, options = {}) {
    const existingArea = await deps.repository.getArea(area.id);
    await deps.repository.upsertArea({ ...area, guildId: deps.guildId });
    const incremental = Boolean(existingArea?.historySyncedAt)
      && !options.dateFrom && !options.dateTo;
    let before = incremental ? null : snowflakeAfter(options.dateTo);
    let pages = 0;
    let indexed = 0;
    let done = false;

    while (!done) {
      const payload = await deps.messages.listMessages(area.id, { limit: 100, before });
      const messages = payload.messages || [];
      if (!messages.length) break;

      for (const message of messages) {
        if (inPeriod(message.timestamp, options.dateFrom, options.dateTo)) {
          await deps.index.indexMessage(message);
          indexed += 1;
        }
      }

      const oldest = messages[0];
      const olderThanWindow = options.dateFrom
        && oldest?.timestamp
        && new Date(oldest.timestamp) < new Date(options.dateFrom);
      before = oldest?.id || null;
      pages += 1;
      done = incremental || !payload.hasMore || !before
        || olderThanWindow || pages >= (options.maxPages || 10_000);
    }

    await deps.repository.markAreaSynced(
      area.id,
      new Date(),
      !options.dateFrom && !options.dateTo,
    );
    deps.logger.info('message_sync_area_completed', {
      areaId: area.id,
      indexedMessages: indexed,
      pages,
      incremental,
    });
    await options.onAreaComplete?.(area);
    return { areaId: area.id, indexed, pages };
  }

  async function syncResolvedScope(resolvedScope, options = {}) {
    const areas = [
      ...(resolvedScope.resolvedChannels || []),
      ...(resolvedScope.resolvedThreads || []),
    ].filter((area) => area.messageable !== false);
    const results = await mapLimit(areas, deps.concurrency, (area) => syncArea(area, options));
    return {
      areas: results.length,
      messages: results.reduce((sum, item) => sum + item.indexed, 0),
      results,
    };
  }

  return { syncArea, syncResolvedScope };
}

export const messageSyncService = createMessageSyncService();
