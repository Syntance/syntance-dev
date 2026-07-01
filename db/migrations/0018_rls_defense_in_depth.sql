-- Faza 15 (M4) — Postgres RLS jako defense-in-depth pod izolacją workspace.
--
-- WAŻNE — dlaczego polityki są "permissive-by-default" (fail-open), a nie
-- restrykcyjne od razu:
--   Aplikacja używa jednej, współdzielonej puli połączeń (`postgres.js` w
--   db/index.ts, bez `prepare:false`+per-request transakcji). Session-scoped
--   `set_config('app.workspace_id', ..., false)` na współdzielonej puli
--   MOŻE PRZECIEKAĆ między niepowiązanymi requestami, jeśli połączenie
--   wróci do puli bez resetu — czyli odwrotność tego, co RLS ma gwarantować
--   (realny wyciek danych między tenantami zamiast go zapobiegać).
--
--   Dopóki warstwa `lib/strategy-hub/context.ts` nie zostanie przepięta na
--   per-request `db.transaction()` z jawnym `set_config(..., true)` (is_local)
--   i resetem po każdym requeście, polityki poniżej celowo NIE zawężają
--   dostępu gdy `app.workspace_id` nie jest ustawione — więc włączenie RLS
--   w tej migracji NIE zmienia obecnego zachowania (egzekucja pozostaje
--   aplikacyjna, w `assertProjectAccess`). To jest jawnie udokumentowany
--   krok pośredni: schema + polityki gotowe, pełne wymuszenie = osobny PR
--   po wprowadzeniu per-request transakcji (patrz docs/adr/0005-rls-rollout.md).

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "projects_workspace_isolation" ON "projects";
--> statement-breakpoint

CREATE POLICY "projects_workspace_isolation" ON "projects"
  USING (
    current_setting('app.workspace_id', true) IS NULL
    OR "workspace_id" = current_setting('app.workspace_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.workspace_id', true) IS NULL
    OR "workspace_id" = current_setting('app.workspace_id', true)::uuid
  );
--> statement-breakpoint

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_self_isolation" ON "workspaces";
--> statement-breakpoint

CREATE POLICY "workspaces_self_isolation" ON "workspaces"
  USING (
    current_setting('app.workspace_id', true) IS NULL
    OR "id" = current_setting('app.workspace_id', true)::uuid
  );
