CREATE TABLE "ai_actions_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"source" varchar(50),
	"tool_name" varchar(100),
	"input_json" jsonb,
	"output_json" jsonb,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_strategy" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"goals_md" text,
	"uvp_md" text,
	"competitors_md" text,
	"objections_md" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100),
	"cost" integer,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "client_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"category" varchar(100),
	"icon" varchar(10),
	"order_idx" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "client_visits_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"section" varchar(100),
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"ip" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"registrar" varchar(100),
	"expires_at" timestamp,
	"ssl_status" varchar(50),
	"dns_provider" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "funnel_element_channels" (
	"funnel_element_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "funnel_element_channels_funnel_element_id_channel_id_pk" PRIMARY KEY("funnel_element_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "funnel_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"segment_id" uuid,
	"name" varchar(255) NOT NULL,
	"position" integer DEFAULT 0,
	"content_md" text,
	"cta" varchar(255),
	"format" varchar(100),
	"status" varchar(50) DEFAULT 'draft',
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hosting_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100),
	"provider" varchar(100),
	"url" text,
	"status" varchar(50) DEFAULT 'active',
	"monthly_cost" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"name" varchar(255) NOT NULL,
	"target" varchar(100),
	"actual" varchar(100),
	"unit" varchar(50),
	"category" varchar(100),
	"deadline" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notion_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"project_id" uuid,
	"notion_url" text,
	"notion_data_source_url" text,
	"last_synced_at" timestamp,
	"last_synced_direction" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "notion_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"direction" varchar(20),
	"status" varchar(50),
	"error" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url_path" varchar(255),
	"type" varchar(100),
	"role_in_funnel" text,
	"cta" varchar(255),
	"goal" text,
	"status" varchar(50) DEFAULT 'draft',
	"priority" integer DEFAULT 0,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(10),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"domain" varchar(255),
	"description" text,
	"client_name" varchar(255),
	"notion_page_url" text,
	"client_access_token" text,
	"client_access_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "purchase_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phase" varchar(100),
	"order_idx" integer DEFAULT 0,
	"trigger" text,
	"objections" text,
	"emotional_state" text,
	"questions" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"persona" text,
	"jtbd" text,
	"problem" text,
	"uvp_text" text,
	"priority" integer DEFAULT 0,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phrase" varchar(500) NOT NULL,
	"intent" varchar(100),
	"volume" integer,
	"difficulty" integer,
	"priority" integer DEFAULT 0,
	"funnel_stage" varchar(100),
	"status" varchar(50) DEFAULT 'research',
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tech_stack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"monthly_cost" integer,
	"yearly_cost" integer,
	"description" text,
	"url" text,
	"status" varchar(50) DEFAULT 'active',
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"segment_id" uuid,
	"entry_element_id" uuid,
	"name" varchar(255) NOT NULL,
	"steps_md" text,
	"conversion_goal" text,
	"type" varchar(100),
	"status" varchar(50) DEFAULT 'draft',
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"workspace_id" uuid,
	"role" varchar(20) DEFAULT 'client' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_actions_log" ADD CONSTRAINT "ai_actions_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_strategy" ADD CONSTRAINT "business_strategy_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_resources" ADD CONSTRAINT "client_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visits_log" ADD CONSTRAINT "client_visits_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_element_channels" ADD CONSTRAINT "funnel_element_channels_funnel_element_id_funnel_elements_id_fk" FOREIGN KEY ("funnel_element_id") REFERENCES "public"."funnel_elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_element_channels" ADD CONSTRAINT "funnel_element_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_elements" ADD CONSTRAINT "funnel_elements_stage_id_purchase_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."purchase_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_elements" ADD CONSTRAINT "funnel_elements_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_mappings" ADD CONSTRAINT "notion_mappings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_sync_log" ADD CONSTRAINT "notion_sync_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_stages" ADD CONSTRAINT "purchase_stages_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_stack" ADD CONSTRAINT "tech_stack_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flows" ADD CONSTRAINT "user_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flows" ADD CONSTRAINT "user_flows_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_actions_log_project_idx" ON "ai_actions_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "client_resources_project_idx" ON "client_resources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "client_visits_log_project_idx" ON "client_visits_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "domains_project_idx" ON "domains" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "funnel_elements_stage_idx" ON "funnel_elements" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "hosting_services_project_idx" ON "hosting_services" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "kpis_project_idx" ON "kpis" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notion_mappings_entity_idx" ON "notion_mappings" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notion_sync_log_project_idx" ON "notion_sync_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pages_project_idx" ON "pages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_slug_workspace_idx" ON "projects" USING btree ("slug","workspace_id");--> statement-breakpoint
CREATE INDEX "purchase_stages_segment_idx" ON "purchase_stages" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "segments_project_idx" ON "segments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "seo_keywords_project_idx" ON "seo_keywords" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tech_stack_project_idx" ON "tech_stack" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "user_flows_project_idx" ON "user_flows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "users_workspace_idx" ON "users" USING btree ("workspace_id");