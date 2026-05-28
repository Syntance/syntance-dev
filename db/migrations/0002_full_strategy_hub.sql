-- Strategy Hub: domknięcie pełnego modelu danych zgodnie ze specyfikacją.
-- Dodaje brakujące moduły (Discovery, Marka, Sprzedaż/copy, dzieci Segmentów,
-- plan kanałów, sekcje stron, audyty, historia zmian) oraz rozszerza
-- segments / pages / uvp. Idempotentne (IF NOT EXISTS).

-- ── Rozszerzenia istniejących tabel ──────────────────────────────────────────

ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "code" varchar(50);
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "persona_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "icon" varchar(10);
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "revenue_share_pct" integer;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "order_idx" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "demographics_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "jtbd_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "problem_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "uvp_for_segment_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "emotional_drivers_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "triggers_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "blockers_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "mentality_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "budget_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "market_size_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "market_data" jsonb;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "kpi_targets" jsonb;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "segment_pricing_md" text;
--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "scoring" jsonb;
--> statement-breakpoint

ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "layout_template" varchar(100);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "priority_tier" varchar(20);
--> statement-breakpoint

ALTER TABLE "uvp" ADD COLUMN IF NOT EXISTS "value_adds_md" text;
--> statement-breakpoint

-- ── Discovery / Onboarding ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" varchar(100),
	"question" text NOT NULL,
	"answer_md" text,
	"our_analysis_md" text,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_questions" ADD CONSTRAINT "project_questions_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_questions_project_idx" ON "project_questions" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_glossary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"term" varchar(255) NOT NULL,
	"definition_md" text,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_glossary" ADD CONSTRAINT "project_glossary_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_glossary_project_idx" ON "project_glossary" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"service_name" varchar(255) NOT NULL,
	"url" text,
	"login" varchar(255),
	"encrypted_secret" text,
	"category" varchar(100),
	"notes" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_credentials" ADD CONSTRAINT "project_credentials_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_credentials_project_idx" ON "project_credentials" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" varchar(50),
	"title" varchar(255) NOT NULL,
	"url" text,
	"source" varchar(100),
	"file_id" varchar(255),
	"notes_md" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_materials_project_idx" ON "project_materials" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_type" varchar(20) DEFAULT 'team' NOT NULL,
	"content_md" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_notes_project_idx" ON "project_notes" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description_md" text,
	"status" varchar(30) DEFAULT 'todo' NOT NULL,
	"owner" varchar(100),
	"due_date" timestamp,
	"priority" integer DEFAULT 2 NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_tasks_project_idx" ON "project_tasks" ("project_id");
--> statement-breakpoint

-- ── Marka ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "brand_identity" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"mission_md" text,
	"vision_md" text,
	"purpose_md" text,
	"brand_pillars_md" text,
	"tone_of_voice_md" text,
	"brand_personality_md" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "brand_identity" ADD CONSTRAINT "brand_identity_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "brand_visual" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"logo_files" jsonb,
	"colors" jsonb,
	"typography" jsonb,
	"brandbook_url" text,
	"usage_guidelines_md" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "brand_visual" ADD CONSTRAINT "brand_visual_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

-- ── Biznes: kryteria segmentacji ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "market_segmentation_criteria" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"dimensions" jsonb,
	"notes_md" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "market_segmentation_criteria" ADD CONSTRAINT "market_segmentation_criteria_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

-- ── Segmenty: dzieci ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "buyer_journey_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"what_does_md" text,
	"time_hint" varchar(100),
	"our_action_md" text,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "buyer_journey_stages" ADD CONSTRAINT "buyer_journey_stages_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_journey_stages_segment_idx" ON "buyer_journey_stages" ("segment_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "segment_quick_wins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description_md" text,
	"deadline" timestamp,
	"status" varchar(30) DEFAULT 'planned' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "segment_quick_wins" ADD CONSTRAINT "segment_quick_wins_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "segment_quick_wins_segment_idx" ON "segment_quick_wins" ("segment_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "segment_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"risk_md" text NOT NULL,
	"mitigation_md" text,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "segment_risks" ADD CONSTRAINT "segment_risks_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "segment_risks_segment_idx" ON "segment_risks" ("segment_id");
--> statement-breakpoint

-- ── Kanały: plan aktywności ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "channel_activity_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"segment_id" uuid,
	"stage" varchar(20),
	"what_to_publish_md" text,
	"cadence" varchar(100),
	"weekly_count" integer,
	"monthly_budget" integer,
	"priority" integer DEFAULT 2 NOT NULL,
	"notes_md" text,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "channel_activity_plan" ADD CONSTRAINT "channel_activity_plan_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "channel_activity_plan" ADD CONSTRAINT "channel_activity_plan_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_activity_plan_channel_idx" ON "channel_activity_plan" ("channel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_activity_plan_segment_idx" ON "channel_activity_plan" ("segment_id");
--> statement-breakpoint

-- ── Sprzedaż / copywriting ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sales_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"context" varchar(100),
	"title" varchar(255) NOT NULL,
	"pitch_md" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "sales_pitches" ADD CONSTRAINT "sales_pitches_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "sales_pitches" ADD CONSTRAINT "sales_pitches_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_pitches_project_idx" ON "sales_pitches" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_pitches_segment_idx" ON "sales_pitches" ("segment_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sales_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"context" varchar(100),
	"name" varchar(255) NOT NULL,
	"script_md" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "sales_scripts" ADD CONSTRAINT "sales_scripts_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_scripts_project_idx" ON "sales_scripts" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "lead_magnets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"name" varchar(255) NOT NULL,
	"format" varchar(100),
	"description_md" text,
	"url" text,
	"conversion_target" varchar(100),
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "lead_magnets" ADD CONSTRAINT "lead_magnets_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "lead_magnets" ADD CONSTRAINT "lead_magnets_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_magnets_project_idx" ON "lead_magnets" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_magnets_segment_idx" ON "lead_magnets" ("segment_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "copy_guidelines" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"principles_md" text,
	"do_md" text,
	"dont_md" text,
	"templates" jsonb,
	"hashtags" jsonb,
	"examples" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "copy_guidelines" ADD CONSTRAINT "copy_guidelines_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

-- ── Strona: dzieci ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "page_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"purpose_md" text,
	"schema_md" text,
	"copy_md" text,
	"cta_text" varchar(255),
	"cta_url" varchar(500),
	"design_notes_md" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_sections_page_idx" ON "page_sections" ("page_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nav_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"url" varchar(500),
	"page_id" uuid,
	"position" varchar(50),
	"type" varchar(50),
	"parent_id" uuid,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nav_items_project_idx" ON "nav_items" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "site_maintenance_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"item" varchar(255) NOT NULL,
	"monthly_cost" integer,
	"yearly_cost" integer,
	"provider" varchar(100),
	"notes_md" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "site_maintenance_costs" ADD CONSTRAINT "site_maintenance_costs_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_maintenance_costs_project_idx" ON "site_maintenance_costs" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "site_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" varchar(50),
	"date" timestamp DEFAULT now() NOT NULL,
	"summary_md" text,
	"severity_high" integer DEFAULT 0,
	"severity_medium" integer DEFAULT 0,
	"severity_low" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_audits_project_idx" ON "site_audits" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "site_audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"page_id" uuid,
	"area" varchar(100),
	"finding_md" text NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"recommendation_md" text,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "site_audit_findings" ADD CONSTRAINT "site_audit_findings_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "site_audits"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "site_audit_findings" ADD CONSTRAINT "site_audit_findings_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_audit_findings_audit_idx" ON "site_audit_findings" ("audit_id");
--> statement-breakpoint

-- ── Historia zmian ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"field" varchar(100),
	"old_value" text,
	"new_value" text,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_history_project_idx" ON "change_history" ("project_id");
--> statement-breakpoint

-- ── KPI: szereg czasowy (sparkline) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"value" varchar(100) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"note" text,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kpi_snapshots_kpi_idx" ON "kpi_snapshots" ("kpi_id");
