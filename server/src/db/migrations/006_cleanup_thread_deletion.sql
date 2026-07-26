ALTER TABLE cleanup_jobs
  ADD COLUMN IF NOT EXISTS estimated_threads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_threads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_threads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_threads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_threads integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cleanup_thread_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_job_id uuid NOT NULL REFERENCES cleanup_jobs(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  thread_name text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  processed_at timestamptz,
  UNIQUE (cleanup_job_id, thread_id)
);

CREATE INDEX IF NOT EXISTS cleanup_thread_items_job_status_idx
  ON cleanup_thread_items (cleanup_job_id, status);
