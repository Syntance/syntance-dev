-- ─── Baza konkurentów — kolumny konfiguratora ────────────────────────────────
--
-- Rozszerza `competitors` o pola potrzebne widokowi-bazie danych w Analizie
-- konkurencji: lokalizacja, specjalizacja, nasz wyróżnik względem TEGO
-- konkurenta i klikalny werdykt cenowy (tańsza/podobna/droższa od naszej).
-- Wszystkie nullable — istniejące wiersze (RetroHouse, Lumine) działają bez zmian.

ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "location" varchar(255);
--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "specialization" varchar(255);
--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "our_edge_md" text;
--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "price_comparison" varchar(20);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "competitors" ADD CONSTRAINT "competitors_price_comparison_check"
    CHECK ("price_comparison" IS NULL OR "price_comparison" IN ('cheaper', 'similar', 'more_expensive'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
