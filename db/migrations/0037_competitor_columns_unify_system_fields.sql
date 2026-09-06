-- ─── Unifikacja kolumn: stałe pola konkurenta dołączają do rejestru ──────────
--
-- Typ, Lokalizacja, Specjalizacja, Cena vs. nasza i Nasz wyróżnik są prawdziwymi,
-- typowanymi kolumnami SQL w `competitors` — nie żyją w `custom_fields` i nie
-- będą tam przenoszone (zbędna migracja danych bez korzyści: kolumna SQL już
-- ma odpowiedni kształt). Zamiast tego dostają wpisy w `competitor_columns`
-- z `source='system'`, żeby dzielić TEN SAM mechanizm przesuwania, etykiety
-- i koloru tekstu co kolumny własne. Typ/opcje tych wpisów są zablokowane
-- w warstwie API — kolumna SQL i tak ma już swój kształt.
--
-- Konkurent (nazwa) NIE dostaje wpisu — zostaje przypięta jako pierwsza,
-- tak jak kolumna tytułowa w każdym narzędziu bazodanowym (Notion/Airtable).

ALTER TABLE "competitor_columns" ADD COLUMN IF NOT EXISTS "source" varchar(10) NOT NULL DEFAULT 'custom';
--> statement-breakpoint
ALTER TABLE "competitor_columns" ADD COLUMN IF NOT EXISTS "field_key" varchar(30);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "competitor_columns" ADD CONSTRAINT "competitor_columns_source_check"
    CHECK ("source" IN ('system', 'custom'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- Robimy miejsce na 5 systemowych wpisów (orderIdx 0-4) przed istniejącymi
-- własnymi kolumnami, zachowując ich wzajemną kolejność.
UPDATE "competitor_columns"
SET "order_idx" = "order_idx" + 5
WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Seed per projekt, który ma choć jednego konkurenta — idempotentnie
-- (NOT EXISTS zamiast unique index, zgodnie z konwencją tej migracji 0011).
INSERT INTO "competitor_columns" ("project_id", "key", "label", "type", "source", "field_key", "order_idx")
SELECT DISTINCT c."project_id", 'typ', 'Typ', 'select', 'system', 'type', 0
FROM "competitors" c
WHERE NOT EXISTS (
  SELECT 1 FROM "competitor_columns" cc
  WHERE cc."project_id" = c."project_id" AND cc."field_key" = 'type' AND cc."deleted_at" IS NULL
);
--> statement-breakpoint

INSERT INTO "competitor_columns" ("project_id", "key", "label", "type", "source", "field_key", "order_idx")
SELECT DISTINCT c."project_id", 'lokalizacja', 'Lokalizacja', 'text', 'system', 'location', 1
FROM "competitors" c
WHERE NOT EXISTS (
  SELECT 1 FROM "competitor_columns" cc
  WHERE cc."project_id" = c."project_id" AND cc."field_key" = 'location' AND cc."deleted_at" IS NULL
);
--> statement-breakpoint

INSERT INTO "competitor_columns" ("project_id", "key", "label", "type", "source", "field_key", "order_idx")
SELECT DISTINCT c."project_id", 'specjalizacja', 'Specjalizacja', 'text', 'system', 'specialization', 2
FROM "competitors" c
WHERE NOT EXISTS (
  SELECT 1 FROM "competitor_columns" cc
  WHERE cc."project_id" = c."project_id" AND cc."field_key" = 'specialization' AND cc."deleted_at" IS NULL
);
--> statement-breakpoint

INSERT INTO "competitor_columns" ("project_id", "key", "label", "type", "source", "field_key", "order_idx")
SELECT DISTINCT c."project_id", 'cena', 'Cena vs. nasza', 'select', 'system', 'price_comparison', 3
FROM "competitors" c
WHERE NOT EXISTS (
  SELECT 1 FROM "competitor_columns" cc
  WHERE cc."project_id" = c."project_id" AND cc."field_key" = 'price_comparison' AND cc."deleted_at" IS NULL
);
--> statement-breakpoint

INSERT INTO "competitor_columns" ("project_id", "key", "label", "type", "source", "field_key", "order_idx")
SELECT DISTINCT c."project_id", 'nasz_wyroznik', 'Nasz wyróżnik', 'long_text', 'system', 'our_edge_md', 4
FROM "competitors" c
WHERE NOT EXISTS (
  SELECT 1 FROM "competitor_columns" cc
  WHERE cc."project_id" = c."project_id" AND cc."field_key" = 'our_edge_md' AND cc."deleted_at" IS NULL
);
