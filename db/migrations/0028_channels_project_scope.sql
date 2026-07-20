-- Domyka dryf migracji wykryty przez CI na świeżej bazie: `channels` w
-- 0000_aberrant_harrier.sql powstało jako workspace-scoped (workspace_id NOT
-- NULL), ale schema.ts od dawna opisuje je jako project-scoped (project_id +
-- path_id/icon/cost_monthly/status/deleted_at) — te kolumny trafiły na
-- środowiska deweloperskie przez `drizzle:push`, nigdy nie jako migrację.
-- Kształt zgodny z `channels` w db/schema.ts; workspace_id zostaje jako
-- martwa, nieużywana przez kod kolumna (drop wymagałby osobnej, ostrożnej
-- migracji — poza zakresem tego fixu).

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "channels" ADD CONSTRAINT "channels_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "channels_project_idx" ON "channels" ("project_id");
--> statement-breakpoint

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "icon" varchar(10);
--> statement-breakpoint

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "cost_monthly" integer;
--> statement-breakpoint

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';
--> statement-breakpoint

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- Kod nigdy nie zapisuje workspace_id (nie ma go w schema.ts) — na świeżej
-- bazie NOT NULL bez wartości domyślnej blokowałby każdy insert kanału.
ALTER TABLE "channels" ALTER COLUMN "workspace_id" DROP NOT NULL;
