ALTER TABLE change_history
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS before_json jsonb,
  ADD COLUMN IF NOT EXISTS undone_at timestamp;

CREATE INDEX IF NOT EXISTS change_history_batch_idx ON change_history (project_id, batch_id);

ALTER TABLE ai_proposals
  ADD COLUMN IF NOT EXISTS batch_id uuid;
