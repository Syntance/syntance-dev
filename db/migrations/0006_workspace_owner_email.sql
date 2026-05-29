-- Dodaje kolumnę owner_email do workspaces (izolacja per-admin)
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "owner_email" varchar(255);

-- Backfill: istniejący workspace należy do głównego admina
UPDATE "workspaces"
SET "owner_email" = 'kamil@syntance.com'
WHERE "owner_email" IS NULL;

-- Unikalny indeks (jeden workspace per email)
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_owner_email_unique"
  ON "workspaces" ("owner_email");
