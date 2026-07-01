-- Faza 16 (M2) — Dashboard klienta na Postgres, wygaszenie Sanity jako źródła
-- prawdy dla dashboardu `/projects/[slug]`. `ClientUser`/`AdminUser`/
-- `PasswordResetToken` już istnieją (Prisma, ta sama baza) — nie są tu tworzone.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "preview_url" text;
--> statement-breakpoint

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "delivery_status" varchar(50) NOT NULL DEFAULT 'design';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_clients" ADD CONSTRAINT "project_clients_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "project_clients_project_idx" ON "project_clients" ("project_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "project_clients_email_idx" ON "project_clients" ("email");
