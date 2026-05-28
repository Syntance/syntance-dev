CREATE TABLE IF NOT EXISTS "element_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scope" varchar(10) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"status" varchar(20) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "element_visibility" ADD CONSTRAINT "element_visibility_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "element_visibility_project_idx" ON "element_visibility" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "element_visibility_lookup_idx" ON "element_visibility" ("project_id","scope","entity_type","entity_id");
