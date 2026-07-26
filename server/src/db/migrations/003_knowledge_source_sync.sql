ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS source_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_source_key_idx
  ON knowledge_documents (source_key)
  WHERE source_key IS NOT NULL;
