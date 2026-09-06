-- ─── Kolumny użytkownika w bazie konkurentów ─────────────────────────────────
--
-- Konfigurator z gotową biblioteką typów pól: text, long_text, number,
-- currency, url, checkbox, select. Definicje kolumn są wspólne dla projektu
-- (competitor_columns), wartości siedzą per wiersz w competitors.custom_fields.

CREATE TABLE IF NOT EXISTS "competitor_columns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "key" varchar(60) NOT NULL,
  "label" varchar(255) NOT NULL,
  "type" varchar(20) NOT NULL,
  "options" jsonb,
  "order_idx" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "competitor_columns" ADD CONSTRAINT "competitor_columns_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "competitor_columns_project_idx" ON "competitor_columns" ("project_id");
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "competitor_columns" ADD CONSTRAINT "competitor_columns_type_check"
    CHECK ("type" IN ('text', 'long_text', 'number', 'currency', 'url', 'checkbox', 'select'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;
