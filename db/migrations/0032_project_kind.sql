-- ─── Projekt wie, czym jest w organizacji ────────────────────────────────────
--
-- `kind`          — firma | galaz | produkt (prezentacja i drzewo organizacji)
-- `parent_project_id` — opcjonalny rodzic w drzewie (produkt → gałąź → firma)
-- `strategy_mode` — wlasna | dziedziczona (skąd czytamy fundament W0)
--
-- Wszystkie kolumny mają default, więc istniejące projekty zachowują dzisiejsze
-- zachowanie: samodzielna firma z własną strategią.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "kind" varchar(20) NOT NULL DEFAULT 'firma';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "strategy_mode" varchar(20) NOT NULL DEFAULT 'wlasna';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "parent_project_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fk"
    FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "projects_parent_idx" ON "projects" ("parent_project_id");
--> statement-breakpoint

-- Projekt nie może być własnym rodzicem (głębsze cykle pilnuje warstwa
-- aplikacyjna w lib/strategy-hub/scope.ts — Postgres nie wyrazi tego w CHECK).
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_not_self"
    CHECK ("parent_project_id" IS NULL OR "parent_project_id" <> "id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_kind_check"
    CHECK ("kind" IN ('firma', 'galaz', 'produkt'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_strategy_mode_check"
    CHECK ("strategy_mode" IN ('wlasna', 'dziedziczona'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
