-- Faza 16 (M2) — realna strona "Raporty" w dashboardzie klienta (zamiast stubu).
-- Trend health score + historia digestów budują się od teraz (cron tygodniowy).

CREATE TABLE IF NOT EXISTS "health_score_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "score" integer NOT NULL,
  "breakdown" jsonb,
  "captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "health_score_snapshots" ADD CONSTRAINT "health_score_snapshots_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "health_snapshots_project_idx" ON "health_score_snapshots" ("project_id", "captured_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "digest_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "sent_to" varchar(255),
  "sent" boolean NOT NULL DEFAULT false,
  "reason" text,
  "alert_count" integer NOT NULL DEFAULT 0,
  "kpi_summary" jsonb,
  "sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "digest_log" ADD CONSTRAINT "digest_log_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "digest_log_project_idx" ON "digest_log" ("project_id", "sent_at");
