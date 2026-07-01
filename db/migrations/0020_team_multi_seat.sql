-- Faza 17 (Role SaaS) — multi-seat RBAC dla panelu agencji.
-- AdminUser dotąd = 1 konto -> 1 workspace (przez workspaces.owner_email).
-- Dodajemy workspace_id + role, żeby wielu adminów mogło współdzielić workspace
-- (owner zaprasza member'ów). Kolumny nullable/domyślne — istniejące konta
-- działają bez zmian (workspace_id backfillowany leniwie przy pierwszym dostępie,
-- patrz lib/strategy-hub/context.ts#getOrCreateWorkspaceForAdmin).

ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint

ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'owner';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "admin_user_workspace_idx" ON "AdminUser" ("workspace_id");
--> statement-breakpoint

-- Rozróżnienie celu tokenu (client_setup — dotychczasowy portal klienta,
-- admin_invite — zaproszenie do zespołu agencji), żeby /api/auth/set-password
-- mógł bezpiecznie obsłużyć oba przepływy jednym tokenem.
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "purpose" varchar(20) NOT NULL DEFAULT 'client_setup';
