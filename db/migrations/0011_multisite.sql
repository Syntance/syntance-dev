-- ─── Multi-site (Strategy Hub 2.0 — Faza 2) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "sites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "domain" varchar(255),
  "type" varchar(100),
  "status" varchar(50) DEFAULT 'active',
  "is_primary" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sites_project_idx" ON "sites" ("project_id");

-- ─── site_id na encjach strony ───────────────────────────────────────────────

ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "site_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "site_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "seo_keywords" ADD COLUMN IF NOT EXISTS "site_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "site_audits" ADD COLUMN IF NOT EXISTS "site_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Backfill: primary site per projekt (idempotentnie) ──────────────────────

INSERT INTO "sites" ("id", "project_id", "name", "domain", "is_primary", "status")
SELECT gen_random_uuid(), p."id", p."name", p."domain", true, 'active'
FROM "projects" p
WHERE p."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "sites" s
    WHERE s."project_id" = p."id"
      AND s."is_primary" = true
      AND s."deleted_at" IS NULL
  );

-- ─── Przypisanie site_id istniejącym rekordom (WHERE site_id IS NULL) ─────────

UPDATE "pages" pg
SET "site_id" = ps."id"
FROM "sites" ps
WHERE pg."site_id" IS NULL
  AND pg."project_id" = ps."project_id"
  AND ps."is_primary" = true
  AND ps."deleted_at" IS NULL;

UPDATE "nav_items" ni
SET "site_id" = ps."id"
FROM "sites" ps
WHERE ni."site_id" IS NULL
  AND ni."project_id" = ps."project_id"
  AND ps."is_primary" = true
  AND ps."deleted_at" IS NULL;

UPDATE "seo_keywords" sk
SET "site_id" = ps."id"
FROM "sites" ps
WHERE sk."site_id" IS NULL
  AND sk."project_id" = ps."project_id"
  AND ps."is_primary" = true
  AND ps."deleted_at" IS NULL;

UPDATE "site_audits" sa
SET "site_id" = ps."id"
FROM "sites" ps
WHERE sa."site_id" IS NULL
  AND sa."project_id" = ps."project_id"
  AND ps."is_primary" = true
  AND ps."deleted_at" IS NULL;
