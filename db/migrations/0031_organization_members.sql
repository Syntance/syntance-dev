-- ─── Członkostwo adminów w organizacjach ─────────────────────────────────────
--
-- Zastępuje `AdminUser.organization_id` (jeden admin → jedna organizacja).
-- Od teraz JEDYNYM źródłem prawdy o dostępie jest ten wiersz: brak wiersza =
-- brak dostępu. Rola jest rolą W ORGANIZACJI, nie globalną — nie ma
-- „superadmina" widzącego cudze organizacje (regresja izolacji, którą złapał
-- audyt 2026-07 na /sync).

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "admin_user_id" text NOT NULL,
  "role" varchar(20) NOT NULL DEFAULT 'member',
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_admin_user_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_members_org_idx" ON "organization_members" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_admin_idx" ON "organization_members" ("admin_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_uq" ON "organization_members" ("organization_id", "admin_user_id");
--> statement-breakpoint

-- ─── Backfill 1: jawne przypisanie z AdminUser.organization_id ───────────────
INSERT INTO "organization_members" ("organization_id", "admin_user_id", "role")
SELECT a."organization_id", a."id", COALESCE(a."role", 'owner')
FROM "AdminUser" a
WHERE a."organization_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "organizations" o WHERE o."id" = a."organization_id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ─── Backfill 2: konta sprzed leniwego backfillu (dopasowanie po owner_email) ─
-- Odwzorowuje dotychczasowy fallback z getOrCreateWorkspaceForAdmin, żeby
-- właściciel nie stracił dostępu do własnej organizacji.
INSERT INTO "organization_members" ("organization_id", "admin_user_id", "role")
SELECT o."id", a."id", 'owner'
FROM "organizations" o
JOIN "AdminUser" a ON lower(a."email") = lower(o."owner_email")
WHERE o."owner_email" IS NOT NULL
ON CONFLICT DO NOTHING;
