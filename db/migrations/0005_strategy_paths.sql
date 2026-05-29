-- ─── Strategy Paths ───────────────────────────────────────────────────────────
-- Nowa tabela: strategy_paths
CREATE TABLE IF NOT EXISTS "strategy_paths" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "color" varchar(30),
  "icon" varchar(10),
  "is_default" boolean NOT NULL DEFAULT false,
  "order_idx" integer NOT NULL DEFAULT 0,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "strategy_paths" ADD CONSTRAINT "strategy_paths_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_paths_project_idx" ON "strategy_paths" ("project_id");

-- ─── path_id w tabelach strategicznych ────────────────────────────────────────
ALTER TABLE "business_problems" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "business_problems" ADD CONSTRAINT "business_problems_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "competitors" ADD CONSTRAINT "competitors_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "objections" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "objections" ADD CONSTRAINT "objections_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "segments" ADD CONSTRAINT "segments_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "channels" ADD CONSTRAINT "channels_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "kpis" ADD CONSTRAINT "kpis_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "sales_pitches" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sales_pitches" ADD CONSTRAINT "sales_pitches_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "sales_scripts" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sales_scripts" ADD CONSTRAINT "sales_scripts_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "lead_magnets" ADD COLUMN IF NOT EXISTS "path_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lead_magnets" ADD CONSTRAINT "lead_magnets_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
