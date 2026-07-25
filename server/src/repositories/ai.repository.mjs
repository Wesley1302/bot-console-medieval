import { database } from '../db/database.mjs';
import { camelRow, camelRows } from '../db/row-mappers.mjs';

export function createAiRepository(db = database) {
  async function createQuery(input) {
    const result = await db.query(
      `INSERT INTO ai_queries (
        id, guild_id, prompt, date_mode, date_from, date_to, status,
        model, selected_targets_json, progress, step
      ) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,0,'Na fila')
      RETURNING *`,
      [
        input.id,
        input.guildId,
        input.prompt,
        input.dateMode,
        input.dateFrom || null,
        input.dateTo || null,
        input.model || null,
        JSON.stringify(input.selectedTargets),
      ],
    );
    return camelRow(result.rows[0]);
  }

  async function getQuery(id, client = db) {
    const result = await client.query('SELECT * FROM ai_queries WHERE id = $1', [id]);
    return camelRow(result.rows[0]);
  }

  async function listQueries(limit = 50) {
    const result = await db.query(
      'SELECT * FROM ai_queries ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(Number(limit) || 50, 1), 100)],
    );
    return camelRows(result.rows);
  }

  async function claimNext(workerId, staleBefore) {
    return db.transaction(async (client) => {
      const found = await client.query(
        `SELECT id FROM ai_queries
         WHERE status = 'queued'
            OR (status NOT IN ('completed','partial','failed','cancelled')
                AND locked_at < $1)
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED LIMIT 1`,
        [staleBefore],
      );
      const id = found.rows[0]?.id;
      if (!id) return null;
      const result = await client.query(
        `UPDATE ai_queries SET status = 'resolving_scope', step = 'Resolvendo locais',
         progress = 5, started_at = COALESCE(started_at, now()),
         locked_at = now(), locked_by = $2, error = NULL
         WHERE id = $1 RETURNING *`,
        [id, workerId],
      );
      return camelRow(result.rows[0]);
    });
  }

  async function updateProgress(id, status, progress, step, extra = {}) {
    const result = await db.query(
      `UPDATE ai_queries SET status = $2, progress = $3, step = $4,
       resolved_scope_json = COALESCE($5, resolved_scope_json),
       query_type = COALESCE($6, query_type), locked_at = now(),
       error = COALESCE($7, error)
       WHERE id = $1 RETURNING *`,
      [
        id,
        status,
        progress,
        step,
        extra.resolvedScope ? JSON.stringify(extra.resolvedScope) : null,
        extra.queryType || null,
        extra.error || null,
      ],
    );
    return camelRow(result.rows[0]);
  }

  async function heartbeat(id, workerId) {
    await db.query(
      `UPDATE ai_queries SET locked_at = now()
       WHERE id = $1 AND locked_by = $2
         AND status NOT IN ('completed','partial','failed','cancelled')`,
      [id, workerId],
    );
  }

  async function replaceEvidence(queryId, evidence) {
    return db.transaction(async (client) => {
      await client.query('DELETE FROM query_evidence WHERE query_id = $1', [queryId]);
      const inserted = [];
      for (let index = 0; index < evidence.length; index += 1) {
        const item = evidence[index];
        const result = await client.query(
          `INSERT INTO query_evidence (
            id, query_id, source_type, source_id, excerpt, message_url,
            relevance_score, citation_order, source_available, metadata_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) RETURNING *`,
          [
            item.id,
            queryId,
            item.sourceType,
            item.sourceId,
            item.excerpt,
            item.messageUrl || null,
            item.relevanceScore || 0,
            index + 1,
            JSON.stringify(item.metadata || {}),
          ],
        );
        inserted.push(camelRow(result.rows[0]));
      }
      return inserted;
    });
  }

  async function listEvidence(queryId) {
    const result = await db.query(
      'SELECT * FROM query_evidence WHERE query_id = $1 ORDER BY citation_order',
      [queryId],
    );
    return camelRows(result.rows);
  }

  async function saveScope(queryId, guildId, name, areas) {
    return db.transaction(async (client) => {
      const scopeResult = await client.query(
        `INSERT INTO query_scopes (guild_id, name) VALUES ($1,$2) RETURNING *`,
        [guildId, name],
      );
      const scope = scopeResult.rows[0];
      for (const area of areas) {
        await client.query(
          `INSERT INTO query_scope_items (scope_id, discord_area_id, selection_type)
           VALUES ($1,$2,$3) ON CONFLICT (scope_id, discord_area_id) DO NOTHING`,
          [scope.id, area.id, area.type],
        );
      }
      await client.query('UPDATE ai_queries SET scope_id = $2 WHERE id = $1', [queryId, scope.id]);
      return camelRow(scope);
    });
  }

  async function complete(id, resultJson, status = 'completed') {
    const result = await db.query(
      `UPDATE ai_queries SET status = $2, progress = 100, step = 'Concluida',
       result_json = $3, completed_at = now(), locked_at = NULL, locked_by = NULL
       WHERE id = $1 RETURNING *`,
      [id, status, JSON.stringify(resultJson)],
    );
    return camelRow(result.rows[0]);
  }

  async function fail(id, error) {
    const result = await db.query(
      `UPDATE ai_queries SET status = 'failed', error = $2, step = 'Falhou',
       completed_at = now(), locked_at = NULL, locked_by = NULL
       WHERE id = $1 RETURNING *`,
      [id, error],
    );
    return camelRow(result.rows[0]);
  }

  async function cancel(id) {
    const result = await db.query(
      `UPDATE ai_queries SET cancel_requested_at = now(),
       status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
       completed_at = CASE WHEN status = 'queued' THEN now() ELSE completed_at END
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return camelRow(result.rows[0]);
  }

  async function finishCancelled(id) {
    const result = await db.query(
      `UPDATE ai_queries SET status = 'cancelled', step = 'Cancelada',
       completed_at = now(), locked_at = NULL, locked_by = NULL
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return camelRow(result.rows[0]);
  }

  return {
    createQuery,
    getQuery,
    listQueries,
    claimNext,
    updateProgress,
    heartbeat,
    replaceEvidence,
    listEvidence,
    saveScope,
    complete,
    fail,
    cancel,
    finishCancelled,
  };
}

export const aiRepository = createAiRepository();
