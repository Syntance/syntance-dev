-- ─── Archiwizacja organizacji-śmieci po testach ──────────────────────────────
--
-- Skrypty `scripts/test-*.ts` tworzyły workspace per przebieg i sprzątały tylko
-- projekt — na bazie referencyjnej zostawiło to 88 z 91 wierszy. Po zmianie
-- nazwy trafiłyby prosto do selektora organizacji.
--
-- ODWRACALNE: ustawiamy `deleted_at`, nie kasujemy. Warunek jest wąski
-- (e-mail właściciela w formacie generowanym przez testy), więc nie ruszy
-- żadnej realnej organizacji. Cofnięcie:
--   UPDATE organizations SET deleted_at = NULL WHERE owner_email LIKE 'test-%@example.com';
--
-- Źródło problemu naprawione w skryptach testowych (sprzątają teraz także
-- organizację) — ta migracja porządkuje wyłącznie zaległości.

UPDATE "organizations"
SET "deleted_at" = now()
WHERE "deleted_at" IS NULL
  AND "owner_email" LIKE 'test-%@example.com';
