-- ─── Rejestr decyzji (Strategy Hub 2.0 — Faza 3) ─────────────────────────────

CREATE TABLE IF NOT EXISTS "strategic_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "path_id" uuid,
  "title" varchar(255) NOT NULL,
  "reason_md" text,
  "evidence_md" text,
  "status" varchar(20) DEFAULT 'active',
  "author_type" varchar(10) DEFAULT 'human',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "strategic_decisions" ADD CONSTRAINT "strategic_decisions_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "strategic_decisions" ADD CONSTRAINT "strategic_decisions_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategic_decisions_project_idx" ON "strategic_decisions" ("project_id");

CREATE TABLE IF NOT EXISTS "decision_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "decision_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "role" varchar(10) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_decision_id_strategic_decisions_id_fk"
    FOREIGN KEY ("decision_id") REFERENCES "strategic_decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_links_decision_idx" ON "decision_links" ("decision_id");
