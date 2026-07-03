CREATE TABLE IF NOT EXISTS entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path_id uuid REFERENCES strategy_paths(id) ON DELETE SET NULL,
  source_type varchar(50) NOT NULL,
  source_id uuid NOT NULL,
  target_type varchar(50) NOT NULL,
  target_id uuid NOT NULL,
  relation_type varchar(50) NOT NULL,
  strength real,
  rationale_md text,
  source varchar(10) NOT NULL DEFAULT 'human',
  confidence real,
  created_by uuid,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS entity_relations_project_idx ON entity_relations (project_id);
CREATE INDEX IF NOT EXISTS entity_relations_source_idx ON entity_relations (source_type, source_id);
CREATE INDEX IF NOT EXISTS entity_relations_target_idx ON entity_relations (target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS entity_relations_uniq ON entity_relations (
  project_id,
  source_type,
  source_id,
  target_type,
  target_id,
  relation_type
) WHERE deleted_at IS NULL;
