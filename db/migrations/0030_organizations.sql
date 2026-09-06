-- ─── Organizacje zamiast workspace'ów ────────────────────────────────────────
--
-- Granica tenanta przenosi się z `workspaces` na `organizations`. To ta sama
-- tabela pod nową nazwą — dane zostają na miejscu, zmienia się znaczenie:
-- organizacja = klient agencji, w środku którego żyją projekty.
--
-- UWAGA: ta migracja NIE jest idempotentna (RENAME). Wymaga runnera z rejestrem
-- `schema_migrations` — patrz scripts/run-migration.ts.

DO $$ BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL
     AND to_regclass('public.organizations') IS NULL THEN
    ALTER TABLE "workspaces" RENAME TO "organizations";
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE "projects" RENAME COLUMN "workspace_id" TO "organization_id";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "workspace_id" TO "organization_id";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AdminUser' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE "AdminUser" RENAME COLUMN "workspace_id" TO "organization_id";
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF to_regclass('public.workspace_branding') IS NOT NULL
     AND to_regclass('public.organization_branding') IS NULL THEN
    ALTER TABLE "workspace_branding" RENAME TO "organization_branding";
    ALTER TABLE "organization_branding" RENAME COLUMN "workspace_id" TO "organization_id";
  END IF;
END $$;
--> statement-breakpoint

-- ─── owner_email przestaje decydować o dostępie ──────────────────────────────
-- Jeden admin agencji należy teraz do WIELU organizacji, więc unikalność
-- e-maila właściciela nie ma sensu (i blokowałaby tworzenie kolejnych).
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "workspaces_owner_email_unique";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_owner_email_unique";
--> statement-breakpoint

-- ─── Nowe kolumny organizacji ────────────────────────────────────────────────
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" varchar(100);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo_file_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- Backfill slugów z nazw; kolizje rozstrzygane numerem porządkowym.
WITH kandydaci AS (
  SELECT
    "id",
    regexp_replace(
      regexp_replace(lower(coalesce("name", 'organizacja')), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) AS baza,
    row_number() OVER (
      PARTITION BY regexp_replace(
        regexp_replace(lower(coalesce("name", 'organizacja')), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      )
      ORDER BY "created_at", "id"
    ) AS nr
  FROM "organizations"
  WHERE "slug" IS NULL
)
UPDATE "organizations" o
SET "slug" = left(
  CASE WHEN k.baza = '' THEN 'organizacja' ELSE k.baza END
  || CASE WHEN k.nr > 1 THEN '-' || k.nr::text ELSE '' END,
  100
)
FROM kandydaci k
WHERE o."id" = k."id";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_uq" ON "organizations" ("slug");
--> statement-breakpoint

-- ─── Higiena nazw indeksów ───────────────────────────────────────────────────
ALTER INDEX IF EXISTS "users_workspace_idx" RENAME TO "users_organization_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "projects_workspace_idx" RENAME TO "projects_organization_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "projects_slug_workspace_idx" RENAME TO "projects_slug_organization_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "admin_user_workspace_idx" RENAME TO "admin_user_organization_idx";
--> statement-breakpoint

-- ─── RLS: klucz sesji app.workspace_id → app.organization_id ─────────────────
-- Polityki pozostają celowo permissive-by-default (fail-open) — patrz komentarz
-- w 0018 i docs/adr/0005-rls-rollout.md. Ta migracja tylko przenosi je na nowe
-- nazwy; egzekucja nadal jest aplikacyjna (assertOrganizationAccess).

DROP POLICY IF EXISTS "projects_workspace_isolation" ON "projects";
--> statement-breakpoint
DROP POLICY IF EXISTS "projects_organization_isolation" ON "projects";
--> statement-breakpoint
CREATE POLICY "projects_organization_isolation" ON "projects"
  USING (
    current_setting('app.organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.organization_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.organization_id', true)::uuid
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_self_isolation" ON "organizations";
--> statement-breakpoint
DROP POLICY IF EXISTS "organizations_self_isolation" ON "organizations";
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "organizations_self_isolation" ON "organizations"
  USING (
    current_setting('app.organization_id', true) IS NULL
    OR "id" = current_setting('app.organization_id', true)::uuid
  );
