-- ─── Komentarze per encja (Strategy Hub 2.0 — Faza 6) ────────────────────────

CREATE TABLE IF NOT EXISTS "entity_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "author_type" varchar(10) DEFAULT 'team',
  "author_name" varchar(255),
  "body" text NOT NULL,
  "mentions" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "entity_comments" ADD CONSTRAINT "entity_comments_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_comments_entity_idx" ON "entity_comments" ("entity_type", "entity_id");
