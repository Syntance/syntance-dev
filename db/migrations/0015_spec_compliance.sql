-- ─── Strategy Hub 2.1 — domknięcie data-modelu pod zgodność ze spec Notion ───
-- Faza 0 (M0). Wszystko addytywne i idempotentne — bezpieczne na istniejących danych.

-- ── Nowe kolumny na istniejących encjach ──

ALTER TABLE "projects"             ADD COLUMN IF NOT EXISTS "graph_layout" jsonb;
ALTER TABLE "kpis"                 ADD COLUMN IF NOT EXISTS "event_key" text;
ALTER TABLE "kpis"                 ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
ALTER TABLE "segments"             ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
ALTER TABLE "objections"           ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
ALTER TABLE "funnel_elements"      ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
ALTER TABLE "pages"                ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
ALTER TABLE "strategic_decisions"  ADD COLUMN IF NOT EXISTS "review_flag" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- ── Kolejka propozycji AI (zero direct write) ──

CREATE TABLE IF NOT EXISTS "ai_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "mode" varchar(20) NOT NULL,
  "entity_type" varchar(50),
  "entity_id" uuid,
  "diff" jsonb,
  "rationale_md" text,
  "sources" jsonb,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolved_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_proposals_project_idx" ON "ai_proposals" ("project_id");
CREATE INDEX IF NOT EXISTS "ai_proposals_status_idx" ON "ai_proposals" ("project_id", "status");
--> statement-breakpoint

-- ── Eksporty i wysyłka ──

CREATE TABLE IF NOT EXISTS "export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "type" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "file_id" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_jobs_project_idx" ON "export_jobs" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "delivery_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "export_job_id" uuid,
  "recipient_email" varchar(255) NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "opened_at" timestamp,
  "channel" varchar(20) DEFAULT 'email' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_export_job_id_export_jobs_id_fk"
    FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_log_project_idx" ON "delivery_log" ("project_id");
--> statement-breakpoint

-- ── Słownik zdarzeń analityki (oś Pomiar) ──

CREATE TABLE IF NOT EXISTS "funnel_element_events" (
  "funnel_element_id" uuid NOT NULL,
  "event_key" varchar(100) NOT NULL,
  "is_conversion" boolean DEFAULT false NOT NULL,
  CONSTRAINT "funnel_element_events_pk" PRIMARY KEY ("funnel_element_id", "event_key")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "funnel_element_events" ADD CONSTRAINT "funnel_element_events_funnel_element_id_funnel_elements_id_fk"
    FOREIGN KEY ("funnel_element_id") REFERENCES "funnel_elements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ── Ścieżki strategii: warstwa N:N (owned/shared) ──
-- Backfill z istniejącego `path_id` należy do warstwy track (M1) — wtedy ustalone są
-- klucze entity_type. Tu tworzymy tylko strukturę.

CREATE TABLE IF NOT EXISTS "track_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "relation" varchar(10) DEFAULT 'owned' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "track_entities" ADD CONSTRAINT "track_entities_track_id_strategy_paths_id_fk"
    FOREIGN KEY ("track_id") REFERENCES "strategy_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_entities_track_idx" ON "track_entities" ("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "track_entities_uq" ON "track_entities" ("track_id", "entity_type", "entity_id");
--> statement-breakpoint

-- ── Junctiony kampanii ──

CREATE TABLE IF NOT EXISTS "campaign_channels" (
  "campaign_id" uuid NOT NULL,
  "channel_id" uuid NOT NULL,
  CONSTRAINT "campaign_channels_pk" PRIMARY KEY ("campaign_id", "channel_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_channels" ADD CONSTRAINT "campaign_channels_campaign_id_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_channels" ADD CONSTRAINT "campaign_channels_channel_id_channels_id_fk"
    FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "campaign_kpis" (
  "campaign_id" uuid NOT NULL,
  "kpi_id" uuid NOT NULL,
  CONSTRAINT "campaign_kpis_pk" PRIMARY KEY ("campaign_id", "kpi_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_kpis" ADD CONSTRAINT "campaign_kpis_campaign_id_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_kpis" ADD CONSTRAINT "campaign_kpis_kpi_id_kpis_id_fk"
    FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ── Junctiony ofert ──

CREATE TABLE IF NOT EXISTS "offer_funnel_elements" (
  "offer_id" uuid NOT NULL,
  "funnel_element_id" uuid NOT NULL,
  CONSTRAINT "offer_funnel_elements_pk" PRIMARY KEY ("offer_id", "funnel_element_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_funnel_elements" ADD CONSTRAINT "offer_funnel_elements_offer_id_offers_id_fk"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_funnel_elements" ADD CONSTRAINT "offer_funnel_elements_funnel_element_id_funnel_elements_id_fk"
    FOREIGN KEY ("funnel_element_id") REFERENCES "funnel_elements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "offer_pages" (
  "offer_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  CONSTRAINT "offer_pages_pk" PRIMARY KEY ("offer_id", "page_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_pages" ADD CONSTRAINT "offer_pages_offer_id_offers_id_fk"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_pages" ADD CONSTRAINT "offer_pages_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ── White-label workspace ──

CREATE TABLE IF NOT EXISTS "workspace_branding" (
  "workspace_id" uuid PRIMARY KEY NOT NULL,
  "logo_file_id" varchar(255),
  "colors" jsonb,
  "custom_domain" varchar(255),
  "email_from" varchar(255),
  "status" varchar(50) DEFAULT 'active',
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_branding" ADD CONSTRAINT "workspace_branding_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
