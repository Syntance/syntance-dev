-- ─── Kampanie, GEO, oferty (Strategy Hub 2.0 — Faza 4) ───────────────────────

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "path_id" uuid,
  "segment_id" uuid,
  "landing_page_id" uuid,
  "name" varchar(255) NOT NULL,
  "goal" text,
  "stage" varchar(20),
  "channels" jsonb,
  "budget_plan" integer,
  "budget_spent" integer,
  "period_start" timestamp,
  "period_end" timestamp,
  "creatives" jsonb,
  "utm" jsonb,
  "status" varchar(50) DEFAULT 'planned',
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_path_id_strategy_paths_id_fk"
    FOREIGN KEY ("path_id") REFERENCES "strategy_paths"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_segments_id_fk"
    FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_landing_page_id_pages_id_fk"
    FOREIGN KEY ("landing_page_id") REFERENCES "pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_project_idx" ON "campaigns" ("project_id");

CREATE TABLE IF NOT EXISTS "funnel_element_campaigns" (
  "funnel_element_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  CONSTRAINT "funnel_element_campaigns_pkey" PRIMARY KEY("funnel_element_id","campaign_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "funnel_element_campaigns" ADD CONSTRAINT "fec_funnel_element_id_fk"
    FOREIGN KEY ("funnel_element_id") REFERENCES "funnel_elements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "funnel_element_campaigns" ADD CONSTRAINT "fec_campaign_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "geo_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "site_id" uuid,
  "page_id" uuid,
  "type" varchar(50) NOT NULL,
  "checklist" jsonb,
  "status" varchar(50) DEFAULT 'todo',
  "notes_md" text,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geo_assets" ADD CONSTRAINT "geo_assets_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geo_assets" ADD CONSTRAINT "geo_assets_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geo_assets" ADD CONSTRAINT "geo_assets_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_assets_project_idx" ON "geo_assets" ("project_id");

CREATE TABLE IF NOT EXISTS "geo_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "target_page_id" uuid,
  "query" text NOT NULL,
  "intent" varchar(100),
  "stage" varchar(20),
  "citation_status" jsonb,
  "status" varchar(50) DEFAULT 'monitoring',
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geo_queries" ADD CONSTRAINT "geo_queries_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geo_queries" ADD CONSTRAINT "geo_queries_target_page_id_pages_id_fk"
    FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_queries_project_idx" ON "geo_queries" ("project_id");

CREATE TABLE IF NOT EXISTS "funnel_element_geo" (
  "funnel_element_id" uuid NOT NULL,
  "geo_asset_id" uuid NOT NULL,
  CONSTRAINT "funnel_element_geo_pkey" PRIMARY KEY("funnel_element_id","geo_asset_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "funnel_element_geo" ADD CONSTRAINT "feg_funnel_element_id_fk"
    FOREIGN KEY ("funnel_element_id") REFERENCES "funnel_elements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "funnel_element_geo" ADD CONSTRAINT "feg_geo_asset_id_fk"
    FOREIGN KEY ("geo_asset_id") REFERENCES "geo_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" varchar(20) DEFAULT 'product',
  "pricing_md" text,
  "uvp_md" text,
  "status" varchar(50) DEFAULT 'active',
  "order_idx" integer DEFAULT 0,
  "deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_project_idx" ON "offers" ("project_id");

CREATE TABLE IF NOT EXISTS "offer_segments" (
  "offer_id" uuid NOT NULL,
  "segment_id" uuid NOT NULL,
  CONSTRAINT "offer_segments_pkey" PRIMARY KEY("offer_id","segment_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_segments" ADD CONSTRAINT "offer_segments_offer_id_fk"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_segments" ADD CONSTRAINT "offer_segments_segment_id_fk"
    FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
