BEGIN;

DROP TABLE IF EXISTS technical_events;
DROP TABLE IF EXISTS cleanup_job_items;
DROP TABLE IF EXISTS cleanup_thread_items;
DROP TABLE IF EXISTS cleanup_jobs;
DROP TABLE IF EXISTS query_evidence;
DROP TABLE IF EXISTS ai_queries;
DROP TABLE IF EXISTS query_scope_items;
DROP TABLE IF EXISTS query_scopes;
DROP TABLE IF EXISTS knowledge_chunks;
DROP TABLE IF EXISTS knowledge_documents;
DROP TABLE IF EXISTS indexed_messages;
DROP TABLE IF EXISTS discord_areas;

COMMIT;
