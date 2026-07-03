# 07 — Plan naprawy po audycie (2026-07-03)

Źródło: pełny audyt aplikacji (statyka + knip + graf + audyt UX na żywej instancji).
Wykonanie: fazy A, D, E, F — Sonnet; fazy B, C — plan zatwierdzony tutaj, egzekucja Sonnet z code-review.
Po **każdej** fazie: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, potem `graphify update .`.

Kolejność faz = kolejność wdrażania (A najpilniejsze). Fazy są niezależne commitowo — każda ma osobny commit/PR.

---

## Faza A — Bezpieczeństwo (pół dnia)

### A1. Filtr workspace na stronie Sync
Plik: `app/(strategy-hub)/strategy-hub/sync/page.tsx` (`getSyncProjects`, linia ~12).

Problem: `SELECT ... FROM projects WHERE deleted_at IS NULL` bez filtra workspace — każdy admin widzi projekty wszystkich workspace'ów. Dodatkowo pętla robi N+1 na `notion_sync_log`.

Zmiany:
1. Pobrać workspace zalogowanego admina tak jak robi to lista projektów — wzorzec z `app/(strategy-hub)/strategy-hub/page.tsx` (`getProjects` → `getOrCreateWorkspaceForAdmin` / `getStrategyHubAccess` w `lib/strategy-hub/context.ts`). Dodać `eq(projects.workspaceId, workspace.id)` do WHERE.
2. Zlikwidować N+1: jedno zapytanie o ostatni log per projekt — `SELECT DISTINCT ON (project_id) ...` przez `sql` helper Drizzle albo window function; dopuszczalne też jedno zapytanie `inArray(notionSyncLog.projectId, ids)` + redukcja w JS.

Akceptacja: admin ze świeżego workspace widzi na `/strategy-hub/sync` pustą listę (test ręczny: konto seed `admin@syntance.com`); liczba zapytań SQL = 2 niezależnie od liczby projektów.

### A2. Fail-closed dla cron i webhooka na produkcji
Pliki:
- `app/api/strategy-hub/digest/route.ts` (`isAuthorized`, linia ~8)
- `app/api/strategy-hub/notion/cron/route.ts` (`isAuthorized`, linia ~16)
- `app/api/strategy-hub/notion/webhook/route.ts` (HMAC, linia ~33)

Wzorzec docelowy — dokładnie ten z `lib/strategy-hub/mcp/handle-request.ts:15`:
```ts
if (!secret) return process.env.NODE_ENV !== "production"; // dev: open, prod: closed
```
W webhooku: gdy `NOTION_WEBHOOK_SECRET` brak na produkcji → 401 (z wyjątkiem gałęzi `verification_token`, która musi działać do rejestracji webhooka — zostawić, ale logować ostrzeżenie).

3 duplikaty `isAuthorized` scalić do jednego helpera `requireCronAuth(req)` w `lib/strategy-hub/api-helpers.ts`.

Akceptacja: na `NODE_ENV=production` bez sekretów wszystkie 3 endpointy zwracają 401; `pnpm test:e2e` zielone.

### A3. Timeout w notionFetch
Plik: `lib/strategy-hub/notion-sync.ts:113`.
Dodać `signal: AbortSignal.timeout(15_000)` do `fetch` w `notionFetch` (jeden punkt — wszystkie wywołania Notion przechodzą przez niego). Obsłużyć `TimeoutError` w catch wyżej tak, by trafiał do `notionSyncLog` jako `status: "error"` (sprawdzić, czy `pushBusinessStrategyToNotion`/`pullFromNotion` już logują błędy — jeśli tak, nic więcej).

Akceptacja: grep `fetch(` w `lib/` nie pokazuje żadnego zewnętrznego fetcha bez `AbortSignal.timeout`.

---

## Faza B — Jedna maszyna stanów (1–2 dni) ⚠️ wymaga uwagi

Cel: `resolveModuleStatuses` (`lib/strategy-hub/rules/state.ts:51`) staje się JEDYNYM źródłem stanu modułów. Znikają trzy równoległe implementacje progu/locków.

Stan obecny (z audytu):
- `statusFromScore` (`lib/strategy-hub/strategy-map-types.ts:183`) — hardcode 80, używany 7× w `lib/strategy-hub/strategy-map.ts` (linie 376–570).
- Locki liczone client-side: `lockedKeys` memo w `components/strategy-hub/strategy-map/map-view.tsx:117` (z krawędzi grafu, nie z `lock.requiresUpstream`).
- `healthDotClass` (`lib/strategy-hub/area-routes.ts:130`) — hardcode 80, konsument: `components/strategy-hub/nav-sidebar.tsx:305`.
- `resolveModuleStatuses` + `resolveStatusesFromContext` — używane wyłącznie w `scripts/test-rules.ts`.

### B1. Serwer: statusy z maszyny stanów
W `getStrategyMapData` (`lib/strategy-hub/strategy-map.ts:105`):
1. Po policzeniu scoringów wszystkich węzłów zbudować `scoreOf` i `reviewOf` (review = dotychczasowa logika `withReview` per moduł — rows z `reviewFlag`).
2. Wywołać `resolveModuleStatuses(rules, { scoreOf, reviewOf })` i brać `status`, `locked`, `blockedBy` z wyniku zamiast `statusFromScore(...)`/`withReview(...)`.
3. Rozszerzyć `StrategyNode` (w `strategy-map-types.ts`) o `locked: boolean` i `blockedBy: string[]`.
4. `withReview` przenieść do wnętrza `reviewOf` (funkcja zostaje, zmienia się punkt użycia).

### B2. Klient: mapa renderuje, nie liczy
`components/strategy-hub/strategy-map/map-view.tsx`:
- Usunąć memo `lockedKeys` (linie ~117–125); brać `node.locked` i `node.blockedBy` z danych.
- Tooltip kłódki: zamiast statycznego „Najpierw uzupełnij poprzedni moduł" → `Najpierw uzupełnij: ${blockedBy.map(labelOf).join(", ")}` (labelki z `rules.modules` już są w danych mapy).
- Sprawdzić `components/strategy-hub/strategy-map/list-view.tsx` i `relation-graph.tsx` — jeśli używają statusów, przejść na te z serwera.

### B3. Sidebar: kropki z readyThreshold
- `healthDotClass(score)` → `healthDotClass(score, readyThreshold)` albo lepiej: endpoint `/api/strategy-hub/projects/[id]/health` zwraca per moduł `state` (z `resolveStatusesFromContext`) i sidebar koloruje po `state`, nie po score. Preferowana opcja druga — usuwa próg z klienta całkowicie.
- Konsument: `nav-sidebar.tsx` (interface `HealthModule` + `areaDotScore`).
- `computeProjectHealth` (`lib/strategy-hub/health-score.ts`) rozszerzyć o stany z `resolveStatusesFromContext` — bridge już istnieje i jest przetestowany.

### B4. statusFromScore — usunąć albo zdegradować
Po B1–B3 `statusFromScore` nie powinien mieć żadnego konsumenta produkcyjnego. Usunąć funkcję; jeśli coś jeszcze jej używa — to jest kolejne miejsce do podpięcia maszyny stanów, nie powód, by ją zostawić.

### B5. Health-score: usunąć minę zahardkodowanych zer
`lib/strategy-hub/health-score.ts:167–173` — siedem liczników na sztywno `0`. Dwie opcje:
- (tania) dociągnąć brakujące county w tym samym `Promise.all` (są to proste `count(*)` po projectId; wzorce zapytań są w `strategy-map.ts`),
- (minimalna) `CriterionContext` rozbić na `Partial` + w `evaluateCriterion` rzucać w dev (`console.warn`) gdy kryterium sięga po licznik, którego kontekst nie dostarczył.
Rekomendacja: opcja tania — od razu naprawia też scenariusz „użytkownik dodał własne kryterium w edytorze reguł".

Akceptacja fazy B:
- `pnpm test` (test-rules) zielone bez modyfikacji testów — testowany kod = kod produkcyjny.
- Ręcznie: świeży projekt → wszystkie moduły poza Fundamentem zablokowane; zmiana `readyThreshold` modułu w `/strategy-hub/settings/rules` (np. 80→20) **zmienia** kolor kropki i status na mapie.
- `grep -r statusFromScore` → 0 wyników poza ewentualnym testem.

---

## Faza C — Jedna taksonomia modułów (1–2 dni) ⚠️ migracja danych

Cel: zostaje 7+N kluczy mapy (`fundament`, `kryteria_rynku`, `segmenty`, `buyer_journey`, `lejek`, `kanaly`, `przekaz`, `strona`, `sekcje`, `seo`, `geo`, `oferta`, `kampanie`, `kpi`, `pitche`); znikają klucze health (`discovery`, `brand`, `business`, `segments`, `funnel`, `sales`, `website`).

Decyzje (zatwierdzone na bazie audytu):
1. `discovery` i `brand` NIE mają odpowiednika w mapie → **dochodzą do taksonomii mapy** jako moduły bez węzła na mapie (flaga `onMap: false` w `ModuleRule` — nowe pole, default `true`).
2. Mapowanie zastępowań: `business`→`fundament`, `segments`→`segmenty`, `funnel`→`lejek`+`kanaly`, `sales`→`przekaz`, `website`→`strona`, `kpi`(health)→`kpi`(map, już wspólny).
3. Kryteria markdown `biz_*` (goalsMd/uvpMd/competitorsMd/objectionsMd) — do usunięcia razem z Fazą F (legacy markdown). Do tego czasu `fundament` przejmuje rolę health-modułu „business".

### C1. Kod
- `lib/strategy-hub/rules/defaults.ts`: usunąć 7 duplikatów modułów; dodać `discovery`, `brand` z `onMap: false`; `HEALTH_MODULE_KEYS` = nowa lista (`discovery`, `brand`, `fundament`, `segmenty`, `lejek`, `kanaly`, `przekaz`, `strona`, `kpi`).
- `lib/strategy-hub/rules/types.ts`: `onMap` w `ModuleRuleSchema` (default true).
- `lib/strategy-hub/area-routes.ts`: `AREA_MODULE_KEYS` i `MODULE_ROUTE_SEGMENTS` przepisać na nowe klucze (foundation: discovery/brand/fundament; market: segmenty; execution: lejek/kanaly/przekaz/strona; measurement: kpi).
- `lib/strategy-hub/health-score.ts`: `buildHint` — klucze na nowe; konteksty liczników już dociągnięte w B5.
- `components/strategy-hub/...`: grep po literałach starych kluczy (`"business"`, `"segments"`, `"funnel"`, `"sales"`, `"website"`, `"discovery"`, `"brand"`) w `app/` i `components/` — głównie `visibility` (MODULE_KEYS w `lib/strategy-hub/visibility.ts`) i client-portal (`applyClientVisibility`). Client portal używa module keys do widoczności — zmapować identycznie.

### C2. Migracja zapisanych rulesetów (KRYTYCZNE)
`resolveRules` (`lib/strategy-hub/rules/resolve.ts:43`) robi deepMerge, w którym **tablica `modules` z zapisanego configu nadpisuje defaults w całości**. Zmiana defaults NIE wystarczy — wiersze `strategy_rule_sets` z zapisaną starą tablicą modules przywrócą duplikaty.

Skrypt `scripts/migrate-rules-taxonomy.ts` (wzorzec: `scripts/run-migration.ts`):
1. Dla każdego wiersza `strategy_rule_sets`: sparsować `config`.
2. Jeśli `config.modules` istnieje: przenieść nadpisania użytkownika ze starych kluczy na nowe wg mapowania z nagłówka fazy (np. user zmienił `readyThreshold` w `segments` → zapisać w `segmenty`); usunąć wpisy starych kluczy; scalić kolizje (priorytet: klucz mapy, bo był widoczny na mapie).
3. Analogicznie `config.connections` i `config.presentationOrder` — przemapować `from`/`to`.
4. Wynik walidować `RulesConfigSchema.parse` przed UPDATE; wiersze niewalidujące się wypisać i pominąć (nie wywalać całej migracji).
5. Backup: przed UPDATE zapisać stare configi do pliku JSON w `scratchpad`/`backups`.

### C3. Wersjonowanie
Podbić `version: 2` w `DEFAULT_RULES` i w migracji; `resolveRules` po merge'u: jeśli wynik zawiera klucz spoza nowej taksonomii → `console.warn` (sygnał niedomigrowanego configu).

Akceptacja fazy C:
- Macierz w `/strategy-hub/settings/rules` pokazuje JEDEN zestaw kluczy (bez par `segments`/`segmenty`).
- Mapa, sidebar, health, client portal działają na projekcie z istniejącymi danymi (test na projekcie „Syntance").
- `scripts/test-rules.ts` zaktualizowane do nowych kluczy przechodzi.

---

## Faza D — Alerty bez szumu (0,5 dnia)

Plik: `lib/strategy-hub/alerts.ts`.

1. **Wizyty** (linia ~85):
   - nowy warunek: alert tylko gdy projekt starszy niż okno ORAZ ma ≥1 wiersz w `project_clients`;
   - osobny konfig `alerts.visitDays` (default 7) w `types.ts`/`defaults.ts` zamiast reużywania `kpiBelowDays`;
   - message interpolowany: `Klient nie otworzył dashboardu w ostatnich ${visitDays} dniach.`
2. **Domena** (linia ~75): placeholder WHOIS usunąć z produkcji — generować alert tylko gdy w danych jest realna data wygaśnięcia (tabela `domains` ma pole na datę — sprawdzić `db/schema.ts:605`); dopóki brak integracji WHOIS, brak daty = brak alertu.
3. **Sync**: dodać brakujący alert wykorzystujący `alerts.syncFailThreshold` — ostatnie N wpisów `notion_sync_log` ze statusem error dla projektu → alert `kind: "sync"` (typ już istnieje w `ProjectAlert`). Alternatywa: usunąć `syncFailThreshold` z types/defaults/rules-editor. Rekomendacja: dodać alert (tani, typ już zdefiniowany).
4. **N+1 KPI** (linia ~44): jedno zapytanie `changeHistory` z `inArray(entityId, kpiIds)` + `DISTINCT ON`/redukcja w JS.

Akceptacja: świeży projekt bez klientów → dzwonek pokazuje 0 alertów; `rules-editor` nie zawiera żadnego pola, które nie ma konsumenta w kodzie.

---

## Faza E — Martwy kod i higiena (0,5 dnia, mechaniczne)

Źródło prawdy: `npx knip --no-progress` (stan na 2026-07-03: 15 plików, 98 eksportów, 30 typów, 4 zależności).

1. Usunąć pliki: `components/strategy-hub/module-visibility.tsx`, `components/strategy-hub/strategy-paths-manager.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/navigation-menu.tsx`.
2. Skrypty jednorazowe (`seed-demo-*`, `run-migration-0005/0006`, `migrate-business-strategy` — UWAGA: potrzebny w fazie F, nie kasować przed nią) → przenieść do `scripts/archive/` + wpis w README skryptów; `reset-password.ts`, `run-sql.ts`, `seed-*.ts` zostają (narzędzia operacyjne) — dodać je do `knip.json` jako `entry`, żeby raport nie krzyczał.
3. Zależności: usunąć `cookie`, `@types/cookie`, `@types/bcryptjs` (bcryptjs ma własne typy od v3).
4. `eslint-plugin-jsx-a11y`: **wpiąć** do `eslint.config.mjs` (flat config: `jsxA11y.flatConfigs.recommended` dla `**/*.tsx`) — WCAG 2.2 AA to inwariant repo. Naprawić zgłoszone naruszenia (spodziewana skala: mała, bo komponenty mają aria-labels).
5. Nieużywane eksporty: zdjąć `export` wg listy knip — POZA symbolami z `lib/strategy-hub/rules/state.ts` (`resolveStatusesFromContext` będzie użyty w fazie B) i `scripts/*`.
6. Resztki konfiguracyjne: usunąć `NEXT_PUBLIC_SANITY_*` z `.env.local` (i z Vercel env), usunąć wpis „Prisma Studio" z `.claude/launch.json`.
7. Po sprzątaniu: `npx knip` czysty albo z jawnie skonfigurowanymi wyjątkami w `knip.json`.

Kolejność względem B/C: eksporty kasować PO fazie B (żeby nie skasować maszyny stanów). Pliki/deps/env można od razu.

---

## Faza F — Lifecycle projektu + domknięcie legacy (1 dzień)

### F1. Usuwanie/archiwizacja projektu
Nigdzie w kodzie nie ma zapisu `projects.deletedAt` — kolumna jest, filtry są, brakuje operacji.
1. `DELETE` w `app/api/strategy-hub/projects/[id]/route.ts`: `requireProjectAccess` → soft-delete `SET deleted_at = NOW()`. Bez kaskady na encje (wszystkie odczyty i tak filtrują po projekcie).
2. UI: akcja „Archiwizuj projekt" w Ustawieniach projektu (`project-settings`) z dialogiem potwierdzenia (wzorzec `Dialog` już w repo); po sukcesie redirect na `/strategy-hub`.
3. (opcjonalnie) widok „Zarchiwizowane" na liście projektów z akcją przywróć (`deleted_at = NULL`) — tani, bo soft-delete.

### F2. Business strategy: jedno źródło prawdy
1. Uruchomić/dokończyć `scripts/migrate-business-strategy.ts` (markdown → encje `businessProblems`/`uvp`/`competitors`/`objections`) na wszystkich projektach; zweryfikować na projekcie „Syntance".
2. Usunąć z `business-strategy-editor.tsx` gałęzie `legacyKey`/markdown dla sekcji, które mają edytory encji; kolumny `goalsMd/uvpMd/competitorsMd/objectionsMd` w `business_strategy` oznaczyć w schema komentarzem `@deprecated` (drop kolumn = osobna migracja później).
3. Kryteria `biz_*` w rules (o ile nie usunięte w fazie C) zamienić na kryteria encji.
4. Zaktualizować `pushBusinessStrategyToNotion` (`notion-sync.ts:330`), żeby renderował z encji, nie z markdownu.

Akceptacja: health „fundament" i mapa liczą z tych samych danych; edytor nie ma dwóch miejsc na UVP/konkurencję/obiekcje.

---

## Poza planem (świadomie odłożone)

- Propagacja review z rozróżnieniem istotności zmiany (dziś: all-or-nothing w `apply-review.ts`) — wymaga decyzji produktowej, co jest „istotną" zmianą.
- Progi jakościowe zamiast ilościowych w kryteriach (≥3 segmenty itd.) — decyzja metodologiczna właściciela, nie kodowa.
- Cykl hipoteza→walidacja na encjach — feature, nie naprawa.
- RLS enforcement (ADR 0005 świadomie fail-open) — osobny track.

## Routing modeli i weryfikacja

| Faza | Model | Weryfikacja dodatkowa |
|---|---|---|
| A | Sonnet | test ręczny sync na koncie seed |
| B | plan: gotowy (ten dokument); egzekucja: Sonnet | `pnpm test` bez zmian w testach + ręczny test progu z UI |
| C | egzekucja: Sonnet; **review migracji: Opus/Fable** | backup configów + test na projekcie „Syntance" |
| D | Sonnet | świeży projekt → 0 alertów |
| E | Sonnet/Haiku | `npx knip` czysty |
| F | Sonnet | e2e (`pnpm test:e2e`) |

Konto testowe: `admin@syntance.com` / `admin123` (seed: `scripts/seed-local-accounts.ts`).
