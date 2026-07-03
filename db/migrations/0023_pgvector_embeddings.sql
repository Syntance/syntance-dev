CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS entity_embeddings (
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_hash varchar(64) NOT NULL,
  embedding vector(1024) NOT NULL,
  model varchar(50) NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS entity_embeddings_project_idx ON entity_embeddings (project_id);
CREATE INDEX IF NOT EXISTS entity_embeddings_hnsw ON entity_embeddings USING hnsw (embedding vector_cosine_ops);
