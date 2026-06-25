ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "hourly_rate" real;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"comment" text,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_project_idx" ON "time_entries" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_user_idx" ON "time_entries" USING btree ("user_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_started_idx" ON "time_entries" USING btree ("started_at");
