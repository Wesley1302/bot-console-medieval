UPDATE knowledge_documents AS document
SET status = 'processing',
    error = NULL,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM knowledge_chunks AS chunk
  WHERE chunk.document_id = document.id
    AND chunk.embedding IS NULL
    AND chunk.embedding_status = 'skipped'
);
