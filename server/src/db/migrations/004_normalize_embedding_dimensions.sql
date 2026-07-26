UPDATE indexed_messages
SET embedding = NULL,
    embedding_model = NULL,
    embedding_status = 'skipped',
    indexed_at = now()
WHERE embedding IS NOT NULL
  AND vector_dims(embedding) <> 768;

UPDATE knowledge_chunks
SET embedding = NULL,
    embedding_model = NULL,
    embedding_status = 'skipped'
WHERE embedding IS NOT NULL
  AND vector_dims(embedding) <> 768;
