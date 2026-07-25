CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS discord_areas (
  discord_id text PRIMARY KEY,
  guild_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('category', 'text', 'announcement', 'forum', 'thread')),
  parent_id text,
  archived boolean NOT NULL DEFAULT false,
  accessible boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  history_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_areas_guild_parent_idx
  ON discord_areas (guild_id, parent_id);

CREATE TABLE IF NOT EXISTS indexed_messages (
  discord_message_id text PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  author_id text NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  edited_at timestamptz,
  message_url text NOT NULL,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_hash text NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  embedding_status text NOT NULL DEFAULT 'pending',
  embedding vector,
  embedding_model text
);

CREATE INDEX IF NOT EXISTS indexed_messages_scope_date_idx
  ON indexed_messages (guild_id, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS indexed_messages_author_date_idx
  ON indexed_messages (guild_id, author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS indexed_messages_text_idx
  ON indexed_messages USING gin (to_tsvector('simple', content));

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('lore', 'law', 'tradition', 'house', 'character', 'server_rule', 'reference')),
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'processing',
  error text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_status_created_idx
  ON knowledge_documents (status, created_at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  section text,
  page integer,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector,
  embedding_model text,
  embedding_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx
  ON knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_text_idx
  ON knowledge_chunks USING gin (to_tsvector('simple', content));

CREATE TABLE IF NOT EXISTS query_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES query_scopes(id) ON DELETE CASCADE,
  discord_area_id text NOT NULL REFERENCES discord_areas(discord_id) ON DELETE CASCADE,
  selection_type text NOT NULL,
  UNIQUE (scope_id, discord_area_id)
);

CREATE TABLE IF NOT EXISTS ai_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  scope_id uuid REFERENCES query_scopes(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  query_type text,
  date_mode text NOT NULL DEFAULT 'all',
  date_from timestamptz,
  date_to timestamptz,
  status text NOT NULL DEFAULT 'queued',
  model text,
  selected_targets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_scope_json jsonb,
  progress integer NOT NULL DEFAULT 0,
  step text,
  result_json jsonb,
  error text,
  cancel_requested_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_queries_status_created_idx
  ON ai_queries (status, created_at);

CREATE TABLE IF NOT EXISTS query_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES ai_queries(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text NOT NULL,
  excerpt text,
  message_url text,
  relevance_score double precision NOT NULL DEFAULT 0,
  citation_order integer NOT NULL,
  source_available boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS query_evidence_query_idx
  ON query_evidence (query_id, citation_order);
CREATE INDEX IF NOT EXISTS query_evidence_source_idx
  ON query_evidence (source_type, source_id);

CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  status text NOT NULL DEFAULT 'previewing',
  resolved_scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  inaccessible_targets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_messages integer NOT NULL DEFAULT 0,
  processed_messages integer NOT NULL DEFAULT 0,
  deleted_messages integer NOT NULL DEFAULT 0,
  failed_messages integer NOT NULL DEFAULT 0,
  skipped_messages integer NOT NULL DEFAULT 0,
  confirmation_token text,
  confirmation_expires_at timestamptz,
  error text,
  cancel_requested_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS cleanup_jobs_status_created_idx
  ON cleanup_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS cleanup_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_job_id uuid NOT NULL REFERENCES cleanup_jobs(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  message_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  processed_at timestamptz,
  UNIQUE (cleanup_job_id, message_id)
);

CREATE INDEX IF NOT EXISTS cleanup_job_items_job_status_idx
  ON cleanup_job_items (cleanup_job_id, status);

CREATE TABLE IF NOT EXISTS technical_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  status text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technical_events_created_idx
  ON technical_events (created_at DESC);
