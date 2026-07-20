-- Domyka drugi (i ostatni — patrz scripts/diff-schema-drift.ts, uruchomione
-- ręcznie i skasowane) fragment dryfu `drizzle:push` wykrytego przez CI na
-- świeżej bazie: dwie kolumny obecne od dawna na dev/prod i w schema.ts,
-- ale nigdy nieujęte w migracjach.

ALTER TABLE "funnel_elements" ADD COLUMN IF NOT EXISTS "cta_url" varchar(500);
--> statement-breakpoint

ALTER TABLE "seo_keywords" ADD COLUMN IF NOT EXISTS "target_page_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_target_page_id_pages_id_fk"
    FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
