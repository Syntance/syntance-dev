# ADR 0005 — Postgres RLS: fail-open scaffolding zamiast natychmiastowego enforcementu

**Status:** Zaakceptowany · **Data:** 2026-07-01 · Migracja: `db/migrations/0018_rls_defense_in_depth.sql`

## Kontekst

Plan (`06-plan-2.1-kompletny.md`, §2 poprawka i §3 odstępstwa) wymaga RLS jako drugiej warstwy obrony
obok egzekucji aplikacyjnej (`lib/strategy-hub/context.ts#assertProjectAccess`), przez
`set_config('app.workspace_id', ...)`. Audyt (Faza 15) potwierdził: **zero** `ENABLE ROW LEVEL
SECURITY`/`CREATE POLICY` w repo.

Kluczowe ograniczenie architektury: `db/index.ts` tworzy **jedno, współdzielone połączenie puli**
(`postgres.js`, bez per-request transakcji). Session-scoped `set_config(..., is_local=false)` na
współdzielonej puli **przecieka między niepowiązanymi requestami**, jeśli połączenie wraca do puli
bez resetu — czyli dokładnie odwrotność tego, co RLS ma gwarantować (realny wyciek danych między
tenantami, gorszy niż stan obecny).

## Decyzja

Migracja `0018` włącza RLS na `projects`/`workspaces`, ale polityki są **fail-open**:
```sql
USING (current_setting('app.workspace_id', true) IS NULL OR workspace_id = ...)
```
Dopóki `app.workspace_id` nie jest ustawione (obecny stan — aplikacja nigdy tego nie robi), polityka
przepuszcza wszystko — **zero zmiany zachowania**, zero ryzyka natychmiastowej regresji. Egzekucja
pozostaje w 100% aplikacyjna (`assertProjectAccess`), tak jak dziś.

To jest świadomie **krok pośredni**, nie pełne wdrożenie. Pełne wymuszenie wymaga osobnego PR, który:
1. Przepina `db/index.ts` / `context.ts` na per-request `db.transaction()` z `set_config(..., true)`
   (is_local — automatycznie resetowane na końcu transakcji, bezpieczne z pulą).
2. Weryfikuje, że KAŻDA ścieżka zapisu/odczytu (~35 encji, dynamiczny dispatch) przechodzi przez ten
   sam wrapper — inaczej RLS po cichu odetnie dane tam, gdzie `set_config` nie zostanie wywołane.
3. Dopiero wtedy usuwa `current_setting(...) IS NULL OR` z polityk (przełącza fail-open → fail-closed).

## Konsekwencje

- **Brak regresji dziś**: `tsc --noEmit` = 0 błędów, build zielony, żadna istniejąca query nie zmienia
  zachowania (polityki nieaktywne funkcjonalnie, dopóki GUC nieustawione).
- **Dług jawnie udokumentowany**, nie ukryty: bez tego ADR ktoś mógłby założyć, że RLS już chroni —
  nie chroni, to tylko przygotowany szkielet.
- Alternatywa odrzucona: wymuszenie RLS już teraz przez wywołanie `set_config` wprost w
  `assertProjectAccess` na współdzielonym połączeniu — odrzucona jako **bardziej ryzykowna niż brak
  RLS** (możliwy wyciek workspace_id między requestami przez pulę połączeń).
- Następny krok (osobny PR, M4+): per-request transaction wrapper + włączenie fail-closed.
