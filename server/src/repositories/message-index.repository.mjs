import { database } from '../db/database.mjs';
import { camelRows } from '../db/row-mappers.mjs';

function vectorLiteral(vector) {
  return Array.isArray(vector) ? `[${vector.map(Number).join(',')}]` : null;
}

export function createMessageIndexRepository(db = database) {
  async function upsertArea(area) {
    await db.query(
      `INSERT INTO discord_areas
        (discord_id, guild_id, name, type, parent_id, archived, accessible, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (discord_id) DO UPDATE SET
         guild_id = EXCLUDED.guild_id, name = EXCLUDED.name, type = EXCLUDED.type,
         parent_id = EXCLUDED.parent_id, archived = EXCLUDED.archived,
         accessible = EXCLUDED.accessible,
         last_synced_at = COALESCE(EXCLUDED.last_synced_at, discord_areas.last_synced_at),
         updated_at = now()`,
      [
        area.id,
        area.guildId,
        area.name,
        area.type,
        area.parentId || null,
        Boolean(area.archived),
        area.accessible !== false,
        area.lastSyncedAt || null,
      ],
    );
  }

  async function markAreaSynced(areaId, timestamp = new Date(), fullHistory = false) {
    await db.query(
      `UPDATE discord_areas SET last_synced_at = $2,
       history_synced_at = CASE WHEN $3 THEN COALESCE(history_synced_at, $2) ELSE history_synced_at END,
       updated_at = now() WHERE discord_id = $1`,
      [areaId, timestamp, fullHistory],
    );
  }

  async function getArea(areaId) {
    const result = await db.query('SELECT * FROM discord_areas WHERE discord_id = $1', [areaId]);
    return camelRows(result.rows)[0] || null;
  }

  async function listAreasForReconciliation(limit = 50) {
    const result = await db.query(
      `SELECT * FROM discord_areas
       ORDER BY COALESCE(last_synced_at, created_at) ASC LIMIT $1`,
      [limit],
    );
    return camelRows(result.rows);
  }

  async function markAreaAccessible(areaId, accessible) {
    await db.query(
      'UPDATE discord_areas SET accessible = $2, updated_at = now() WHERE discord_id = $1',
      [areaId, accessible],
    );
  }

  async function upsertMessage(message) {
    await db.query(
      `INSERT INTO indexed_messages (
        discord_message_id, guild_id, channel_id, author_id, author_name,
        content, created_at, edited_at, message_url, attachments_json,
        source_hash, indexed_at, embedding_status, embedding, embedding_model
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13::vector,$14)
      ON CONFLICT (discord_message_id) DO UPDATE SET
        author_id = EXCLUDED.author_id, author_name = EXCLUDED.author_name,
        content = EXCLUDED.content, edited_at = EXCLUDED.edited_at,
        message_url = EXCLUDED.message_url,
        attachments_json = EXCLUDED.attachments_json,
        source_hash = EXCLUDED.source_hash, indexed_at = now(),
        embedding_status = EXCLUDED.embedding_status,
        embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model`,
      [
        message.id,
        message.guildId,
        message.channelId,
        message.authorId,
        message.authorName,
        message.content,
        message.createdAt,
        message.editedAt || null,
        message.messageUrl,
        JSON.stringify(message.attachments || []),
        message.sourceHash,
        message.embeddingStatus,
        vectorLiteral(message.embedding),
        message.embeddingModel || null,
      ],
    );
  }

  async function deleteMessages(messageIds) {
    const ids = [...new Set((messageIds || []).map(String).filter(Boolean))];
    if (!ids.length) return;
    await db.transaction(async (client) => {
      await client.query(
        `UPDATE query_evidence SET excerpt = NULL, source_available = false
         WHERE source_type = 'discord_message' AND source_id = ANY($1::text[])`,
        [ids],
      );
      await client.query(
        'DELETE FROM indexed_messages WHERE discord_message_id = ANY($1::text[])',
        [ids],
      );
    });
  }

  async function countByChannels(channelIds, dateFrom = null, dateTo = null) {
    if (!channelIds.length) return 0;
    const result = await db.query(
      `SELECT count(*)::integer AS count FROM indexed_messages
       WHERE channel_id = ANY($1::text[])
         AND ($2::timestamptz IS NULL OR created_at >= $2)
         AND ($3::timestamptz IS NULL OR created_at <= $3)`,
      [channelIds, dateFrom, dateTo],
    );
    return result.rows[0]?.count || 0;
  }

  async function searchText({ guildId, channelIds, query, dateFrom, dateTo, authorId, limit }) {
    const result = await db.query(
      `SELECT *, ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $3)) AS relevance_score
       FROM indexed_messages
       WHERE guild_id = $1 AND channel_id = ANY($2::text[])
         AND ($3 = '' OR to_tsvector('simple', content) @@ plainto_tsquery('simple', $3))
         AND ($4::timestamptz IS NULL OR created_at >= $4)
         AND ($5::timestamptz IS NULL OR created_at <= $5)
         AND ($6::text IS NULL OR author_id = $6)
       ORDER BY relevance_score DESC, created_at DESC LIMIT $7`,
      [guildId, channelIds, query || '', dateFrom || null, dateTo || null, authorId || null, limit],
    );
    return camelRows(result.rows);
  }

  async function searchSemantic({ guildId, channelIds, embedding, dateFrom, dateTo, limit }) {
    if (!embedding?.length) return [];
    const result = await db.query(
      `SELECT *, 1 - (embedding <=> $3::vector) AS relevance_score
       FROM indexed_messages
       WHERE guild_id = $1 AND channel_id = ANY($2::text[])
         AND embedding IS NOT NULL
         AND ($4::timestamptz IS NULL OR created_at >= $4)
         AND ($5::timestamptz IS NULL OR created_at <= $5)
       ORDER BY embedding <=> $3::vector LIMIT $6`,
      [guildId, channelIds, vectorLiteral(embedding), dateFrom || null, dateTo || null, limit],
    );
    return camelRows(result.rows);
  }

  async function latestByAuthor({ guildId, channelIds, authorId, dateFrom, dateTo }) {
    const result = await db.query(
      `SELECT * FROM indexed_messages
       WHERE guild_id = $1 AND channel_id = ANY($2::text[]) AND author_id = $3
         AND ($4::timestamptz IS NULL OR created_at >= $4)
         AND ($5::timestamptz IS NULL OR created_at <= $5)
       ORDER BY created_at DESC LIMIT 1`,
      [guildId, channelIds, authorId, dateFrom || null, dateTo || null],
    );
    return camelRows(result.rows)[0] || null;
  }

  async function reconciliationCandidates(limit = 100) {
    const result = await db.query(
      `SELECT discord_message_id, channel_id FROM indexed_messages
       ORDER BY indexed_at ASC LIMIT $1`,
      [limit],
    );
    return camelRows(result.rows);
  }

  return {
    upsertArea,
    getArea,
    listAreasForReconciliation,
    markAreaAccessible,
    markAreaSynced,
    upsertMessage,
    deleteMessages,
    countByChannels,
    searchText,
    searchSemantic,
    latestByAuthor,
    reconciliationCandidates,
  };
}

export const messageIndexRepository = createMessageIndexRepository();
