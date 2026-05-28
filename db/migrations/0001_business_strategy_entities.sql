-- Strategia biznesowa: refactor z 4 markdownów (business_strategy)
-- na 5 osobnych encji relacyjnych. Stara tabela business_strategy
-- zostaje na razie — usunięcie w PR 1.5 po pełnej migracji danych.

CREATE TABLE "business_problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"problem_md" text NOT NULL,
	"ambition_md" text,
	"our_solution_md" text,
	"priority" integer DEFAULT 2 NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

ALTER TABLE "business_problems"
ADD CONSTRAINT "business_problems_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

CREATE INDEX "business_problems_project_idx" ON "business_problems" ("project_id");
--> statement-breakpoint

CREATE TABLE "uvp" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"core_uvp_md" text,
	"value_adds_json" text,
	"differentiators" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint

ALTER TABLE "uvp"
ADD CONSTRAINT "uvp_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

CREATE TABLE "brand_positioning" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"axis_x_label" varchar(100),
	"axis_y_label" varchar(100),
	"our_x" real,
	"our_y" real,
	"our_label" varchar(100),
	"competitors_on_quadrant" jsonb,
	"statement_md" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint

ALTER TABLE "brand_positioning"
ADD CONSTRAINT "brand_positioning_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"name" varchar(255) NOT NULL,
	"url" text,
	"type" varchar(20) DEFAULT 'direct' NOT NULL,
	"strengths_md" text,
	"weaknesses_md" text,
	"pricing_md" text,
	"channels_md" text,
	"notes_md" text,
	"quadrant_x" real,
	"quadrant_y" real,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

ALTER TABLE "competitors"
ADD CONSTRAINT "competitors_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

ALTER TABLE "competitors"
ADD CONSTRAINT "competitors_segment_id_segments_id_fk"
FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null;
--> statement-breakpoint

CREATE INDEX "competitors_project_idx" ON "competitors" ("project_id");
--> statement-breakpoint

CREATE INDEX "competitors_segment_idx" ON "competitors" ("segment_id");
--> statement-breakpoint

CREATE TABLE "objections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"stage" varchar(20),
	"objection_md" text NOT NULL,
	"response_md" text,
	"proof_md" text,
	"priority" integer DEFAULT 2 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"source" varchar(20) DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

ALTER TABLE "objections"
ADD CONSTRAINT "objections_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
--> statement-breakpoint

ALTER TABLE "objections"
ADD CONSTRAINT "objections_segment_id_segments_id_fk"
FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null;
--> statement-breakpoint

CREATE INDEX "objections_project_idx" ON "objections" ("project_id");
--> statement-breakpoint

CREATE INDEX "objections_segment_idx" ON "objections" ("segment_id");
