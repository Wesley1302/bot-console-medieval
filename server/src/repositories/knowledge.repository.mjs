import { database } from '../db/database.mjs';
import { camelRow, camelRows } from '../db/row-mappers.mjs';

function vectorLiteral(vector) {
  return Array.isArray(vector) ? `[${vector.map(Number).join(',')}]` : null;
}

export function createKnowledgeRepository(db = database) {
  async function createDocument(input) {
    const result = await db.query(
      `INSERT INTO knowledge_documents
        (id, title, type, original_filename, storage_path, status)
       VALUES ($1,$2,$3,$4,$5,'processing') RETURNING *`,
      [input.id, input.title, input.type, input.originalFilename, input.storagePath],
    );
    return camelRow(result.rows[0]);
  }

  async function getDocument(id) {
    const result = await db.query('SELECT * FROM knowledge_documents WHERE id = $1', [id]);
    return camelRow(result.rows[0]);
  }

  async function getDocumentBySourceKey(sourceKey) {
    const result = await db.query(
      'SELECT * FROM knowledge_documents WHERE source_key = $1',
      [sourceKey],
    );
    return camelRow(result.rows[0]);
  }

  async function upsertSourceDocument(input) {
    const result = await db.query(
      `INSERT INTO knowledge_documents (
        id, title, type, original_filename, storage_path, source_key, source_hash, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'processing')
      ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        original_filename = EXCLUDED.original_filename,
        storage_path = EXCLUDED.storage_path,
        source_hash = EXCLUDED.source_hash,
        status = CASE
          WHEN knowledge_documents.source_hash IS DISTINCT FROM EXCLUDED.source_hash
            OR knowledge_documents.status = 'failed'
          THEN 'processing'
          ELSE knowledge_documents.status
        END,
        error = CASE
          WHEN knowledge_documents.source_hash IS DISTINCT FROM EXCLUDED.source_hash
            OR knowledge_documents.status = 'failed'
          THEN NULL
          ELSE knowledge_documents.error
        END,
        locked_at = CASE
          WHEN knowledge_documents.source_hash IS DISTINCT FROM EXCLUDED.source_hash
          THEN NULL
          ELSE knowledge_documents.locked_at
        END,
        locked_by = CASE
          WHEN knowledge_documents.source_hash IS DISTINCT FROM EXCLUDED.source_hash
          THEN NULL
          ELSE knowledge_documents.locked_by
        END,
        updated_at = now()
      RETURNING *`,
      [
        input.id,
        input.title,
        input.type,
        input.originalFilename,
        input.storagePath,
        input.sourceKey,
        input.sourceHash,
      ],
    );
    return camelRow(result.rows[0]);
  }

  async function listDocuments() {
    const result = await db.query('SELECT * FROM knowledge_documents ORDER BY created_at DESC');
    return camelRows(result.rows);
  }

  async function claimNext(workerId, staleBefore) {
    return db.transaction(async (client) => {
      const found = await client.query(
        `SELECT id FROM knowledge_documents
         WHERE (status = 'processing' AND locked_at IS NULL)
            OR (status = 'processing' AND locked_at < $1)
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED LIMIT 1`,
        [staleBefore],
      );
      const id = found.rows[0]?.id;
      if (!id) return null;
      const result = await client.query(
        `UPDATE knowledge_documents SET locked_at = now(), locked_by = $2,
         error = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, workerId],
      );
      return camelRow(result.rows[0]);
    });
  }

  async function replaceChunks(documentId, chunks) {
    await db.transaction(async (client) => {
      await client.query('DELETE FROM knowledge_chunks WHERE document_id = $1', [documentId]);
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO knowledge_chunks (
            document_id, content, section, page, metadata_json,
            embedding, embedding_model, embedding_status
          ) VALUES ($1,$2,$3,$4,$5,$6::vector,$7,$8)`,
          [
            documentId,
            chunk.content,
            chunk.section || null,
            chunk.page || null,
            JSON.stringify(chunk.metadata || {}),
            vectorLiteral(chunk.embedding),
            chunk.embeddingModel || null,
            chunk.embeddingStatus,
          ],
        );
      }
      await client.query(
        `UPDATE knowledge_documents SET status = 'available', error = NULL,
         version = version + 1, locked_at = NULL, locked_by = NULL,
         updated_at = now() WHERE id = $1`,
        [documentId],
      );
    });
  }

  async function markFailed(id, error) {
    await db.query(
      `UPDATE knowledge_documents SET status = 'failed', error = $2,
       locked_at = NULL, locked_by = NULL, updated_at = now() WHERE id = $1`,
      [id, error],
    );
  }

  async function reprocessDocument(id) {
    const result = await db.query(
      `UPDATE knowledge_documents SET status = 'processing', error = NULL,
       locked_at = NULL, locked_by = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return camelRow(result.rows[0]);
  }

  async function deleteDocument(id) {
    return db.transaction(async (client) => {
      const found = await client.query('SELECT * FROM knowledge_documents WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rows[0]) return null;
      await client.query(
        `UPDATE query_evidence SET excerpt = NULL, source_available = false
         WHERE source_type = 'knowledge_document'
           AND source_id IN (SELECT id::text FROM knowledge_chunks WHERE document_id = $1)`,
        [id],
      );
      await client.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
      return camelRow(found.rows[0]);
    });
  }

  async function searchText(query, limit = 10) {
    const result = await db.query(
      `SELECT kc.*, kd.title, kd.type,
       ts_rank(to_tsvector('simple', kc.content), plainto_tsquery('simple', $1)) AS relevance_score
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.status = 'available'
         AND ($1 = '' OR to_tsvector('simple', kc.content) @@ plainto_tsquery('simple', $1))
       ORDER BY relevance_score DESC, kc.created_at DESC LIMIT $2`,
      [query || '', limit],
    );
    return camelRows(result.rows);
  }

  async function searchSemantic(embedding, limit = 10) {
    if (!embedding?.length) return [];
    const result = await db.query(
      `SELECT kc.*, kd.title, kd.type, 1 - (kc.embedding <=> $1::vector) AS relevance_score
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.status = 'available' AND kc.embedding IS NOT NULL
       ORDER BY kc.embedding <=> $1::vector LIMIT $2`,
      [vectorLiteral(embedding), limit],
    );
    return camelRows(result.rows);
  }

  return {
    createDocument,
    getDocument,
    getDocumentBySourceKey,
    upsertSourceDocument,
    listDocuments,
    claimNext,
    replaceChunks,
    markFailed,
    reprocessDocument,
    deleteDocument,
    searchText,
    searchSemantic,
  };
}

export const knowledgeRepository = createKnowledgeRepository();
