ALTER TABLE discord_areas
  ADD COLUMN IF NOT EXISTS history_synced_at timestamptz;

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

CREATE INDEX IF NOT EXISTS knowledge_documents_status_created_idx
  ON knowledge_documents (status, created_at);
