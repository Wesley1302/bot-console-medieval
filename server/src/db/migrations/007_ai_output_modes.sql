ALTER TABLE ai_queries
  ADD COLUMN IF NOT EXISTS output_mode text NOT NULL DEFAULT 'analysis';

ALTER TABLE ai_queries
  ADD CONSTRAINT ai_queries_output_mode_check
  CHECK (output_mode IN ('analysis', 'announcement', 'narration'));
