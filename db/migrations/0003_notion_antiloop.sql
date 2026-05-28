ALTER TABLE "notion_mappings" ADD COLUMN IF NOT EXISTS "last_push_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "notion_mappings" ADD COLUMN IF NOT EXISTS "last_pushed_at" timestamp;
