import { database } from '../db/database.mjs';
import { camelRow, camelRows } from '../db/row-mappers.mjs';

export function createCleanupRepository(db = database) {
  async function createPreview(input) {
    const result = await db.query(
      `INSERT INTO cleanup_jobs (
        id, guild_id, target_type, target_id, target_name, status,
        resolved_scope_json, inaccessible_targets_json, warnings_json,
        estimated_messages, confirmation_token, confirmation_expires_at
      ) VALUES ($1,$2,$3,$4,$5,'awaiting_confirmation',$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        input.id,
        input.guildId,
        input.targetType,
        input.targetId,
        input.targetName,
        JSON.stringify(input.resolvedScope),
        JSON.stringify(input.inaccessibleTargets || []),
        JSON.stringify(input.warnings || []),
        input.estimatedMessages || 0,
        input.confirmationTokenHash,
        input.expiresAt,
      ],
    );
    return camelRow(result.rows[0]);
  }

  async function getJob(id, client = db) {
    const result = await client.query('SELECT * FROM cleanup_jobs WHERE id = $1', [id]);
    return camelRow(result.rows[0]);
  }

  async function listJobs(limit = 50) {
    const result = await db.query(
      'SELECT * FROM cleanup_jobs ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(Number(limit) || 50, 1), 100)],
    );
    return camelRows(result.rows);
  }

  async function confirmJob(id, workerInput = {}) {
    return db.transaction(async (client) => {
      const current = await getJob(id, client);
      if (!current) return null;
      const result = await client.query(
        `UPDATE cleanup_jobs
         SET status = 'queued', confirmation_token = NULL,
             confirmation_expires_at = NULL, error = NULL,
             cancel_requested_at = NULL
         WHERE id = $1 AND status = 'awaiting_confirmation'
         RETURNING *`,
        [id],
      );
      if (result.rows[0] && workerInput.eventType) {
        await client.query(
          `INSERT INTO technical_events (event_type, entity_type, entity_id, status, metadata_json)
           VALUES ($1, 'cleanup_job', $2, 'queued', $3)`,
          [workerInput.eventType, id, JSON.stringify(workerInput.metadata || {})],
        );
      }
      return camelRow(result.rows[0]);
    });
  }

  async function claimNext(workerId, staleBefore) {
    return db.transaction(async (client) => {
      const result = await client.query(
        `SELECT id FROM cleanup_jobs
         WHERE status = 'queued'
            OR (status = 'running' AND locked_at < $1)
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [staleBefore],
      );
      const id = result.rows[0]?.id;
      if (!id) return null;
      const claimed = await client.query(
        `UPDATE cleanup_jobs
         SET status = 'running', locked_by = $2, locked_at = now(),
             started_at = COALESCE(started_at, now()), error = NULL
         WHERE id = $1 RETURNING *`,
        [id, workerId],
      );
      return camelRow(claimed.rows[0]);
    });
  }

  async function heartbeat(id, workerId) {
    await db.query(
      `UPDATE cleanup_jobs SET locked_at = now()
       WHERE id = $1 AND locked_by = $2 AND status = 'running'`,
      [id, workerId],
    );
  }

  async function addItems(jobId, channelId, messages) {
    if (!messages.length) return;
    await db.transaction(async (client) => {
      for (const message of messages) {
        await client.query(
          `INSERT INTO cleanup_job_items
            (cleanup_job_id, channel_id, message_id, status)
           VALUES ($1,$2,$3,'queued')
           ON CONFLICT (cleanup_job_id, message_id) DO NOTHING`,
          [jobId, channelId, String(message.id)],
        );
      }
      await client.query(
        `UPDATE cleanup_jobs SET estimated_messages = GREATEST(
           estimated_messages,
           (SELECT count(*)::integer FROM cleanup_job_items WHERE cleanup_job_id = $1)
         ) WHERE id = $1`,
        [jobId],
      );
    });
  }

  async function listPendingItems(jobId, channelId, limit = 100) {
    const result = await db.query(
      `SELECT * FROM cleanup_job_items
       WHERE cleanup_job_id = $1 AND channel_id = $2 AND status = 'queued'
       ORDER BY id LIMIT $3`,
      [jobId, channelId, limit],
    );
    return camelRows(result.rows);
  }

  async function markItems(jobId, messageIds, status, error = null) {
    if (!messageIds.length) return;
    await db.query(
      `UPDATE cleanup_job_items
       SET status = $3, error = $4, processed_at = now()
       WHERE cleanup_job_id = $1 AND message_id = ANY($2::text[])`,
      [jobId, messageIds.map(String), status, error],
    );
  }

  async function updateProgress(id, counters, extra = {}) {
    const result = await db.query(
      `UPDATE cleanup_jobs SET
         processed_messages = processed_messages + $2,
         deleted_messages = deleted_messages + $3,
         failed_messages = failed_messages + $4,
         skipped_messages = skipped_messages + $5,
         estimated_messages = GREATEST(estimated_messages, $6),
         locked_at = now(),
         error = COALESCE($7, error)
       WHERE id = $1 RETURNING *`,
      [
        id,
        counters.processed || 0,
        counters.deleted || 0,
        counters.failed || 0,
        counters.skipped || 0,
        extra.estimatedMessages || 0,
        extra.error || null,
      ],
    );
    return camelRow(result.rows[0]);
  }

  async function setAction(id, action) {
    const updates = {
      cancel: `status = CASE WHEN status IN ('queued','paused') THEN 'cancelled' ELSE status END,
               cancel_requested_at = now(),
               finished_at = CASE WHEN status IN ('queued','paused') THEN now() ELSE finished_at END`,
      pause: `status = CASE WHEN status IN ('queued','running') THEN 'paused' ELSE status END,
              locked_by = NULL, locked_at = NULL`,
      resume: `status = CASE WHEN status = 'paused' THEN 'queued' ELSE status END,
               cancel_requested_at = NULL, locked_by = NULL, locked_at = NULL`,
    };
    const clause = updates[action];
    if (!clause) return null;
    const result = await db.query(
      `UPDATE cleanup_jobs SET ${clause} WHERE id = $1 RETURNING *`,
      [id],
    );
    return camelRow(result.rows[0]);
  }

  async function finish(id, status, error = null) {
    const result = await db.query(
      `UPDATE cleanup_jobs SET status = $2, error = $3, finished_at = now(),
         locked_by = NULL, locked_at = NULL
       WHERE id = $1 RETURNING *`,
      [id, status, error],
    );
    return camelRow(result.rows[0]);
  }

  return {
    createPreview,
    getJob,
    listJobs,
    confirmJob,
    claimNext,
    heartbeat,
    addItems,
    listPendingItems,
    markItems,
    updateProgress,
    setAction,
    finish,
  };
}

export const cleanupRepository = createCleanupRepository();
