-- ─── Strategy Hub 2.1 — jawne FK tam, gdzie kolumna istniała bez ograniczenia ───
-- Faza 0 (M0), dopełnienie. Zweryfikowano brak osieroconych wierszy przed dodaniem.

DO $$ BEGIN
  ALTER TABLE "competitors" ADD CONSTRAINT "competitors_segment_id_segments_id_fk"
    FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "objections" ADD CONSTRAINT "objections_segment_id_segments_id_fk"
    FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "user_flows" ADD CONSTRAINT "user_flows_entry_element_id_funnel_elements_id_fk"
    FOREIGN KEY ("entry_element_id") REFERENCES "funnel_elements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_parent_id_nav_items_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "nav_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
