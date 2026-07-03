# Archiwum skryptów

Skrypty jednorazowe, które już wykonały swoje zadanie (migracje ręczne, seed danych
demo/firmowych już uruchomiony w docelowym środowisku). Trzymane dla historii i jako
wzorzec, jeśli podobna operacja będzie potrzebna ponownie — nie uruchamiaj ich bez
sprawdzenia, czy dane, które zakładają, nie istnieją już w innej formie.

- `apply-pending-migrations.ts`, `run-migration-0005.ts`, `run-migration-0006.ts` — ręczne migracje SQL sprzed ujednolicenia na `db:migrate:apply` (`scripts/run-migration.ts`).
- `seed-demo-admin.ts`, `seed-demo-workspace.ts` — konto/workspace demo do prezentacji inwestorskich.
- `seed-syntance-company.ts` — jednorazowy backfill danych firmy Syntance (hardkodowane ID projektu/workspace).
- `migrate-rules-taxonomy.ts` — jednorazowe scalenie taksonomii modułów reguł (Strategy Hub 2.1, audyt 2026-07). Idempotentny, ale taksonomia jest już zmigrowana w produkcyjnej bazie.
