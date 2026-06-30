# ADR 0002 — Nawigacja 5 obszarów Strategy Hub 2.0

## Status

Zaakceptowany (Faza 1 Strategy Hub 2.0)

## Kontekst

Sidebar Strategy Hub zawierał płaską listę ~12 modułów (`viewItems` + `strategyItems`) oraz osobną pozycję „Strategy Map". Użytkownik tracił orientację w strukturze strategii; deep-linki do modułów nie odzwierciedlały logicznych grup (fundament, rynek, egzekucja, pomiar, ustawienia).

## Decyzja

1. **5 obszarów w sidebarze** — Fundament, Rynek, Egzekucja, Pomiar, Ustawienia projektu; każdy z tab-barem (pod-route + wspólny `layout.tsx` z `AreaTabBar`).
2. **Ekran zerowy** — `/strategy-hub/projects/[id]` renderuje `<StrategyMap mode="editor" />` (scalone ze `strategy-map`); pozycja „Strategy Map" usunięta z sidebara.
3. **Mapowanie tras** — moduły jako zakładki w obszarach (np. `brand` → `foundation/brand`, `marketing` → `execution/channels`); źródło prawdy w `lib/strategy-hub/area-routes.ts`.
4. **Redirecty** — stare URL-e (`/brand`, `/marketing`, …) → cienkie `page.tsx` z `redirect()` przez ≥1 release.
5. **Health-score w sidebarze** — kropka per obszar = średnia modułów przypisanych w `AREA_MODULE_KEYS`; kolory: ≥80 zielony, >0 żółty, =0 szary.
6. **Custom Apps i System** — bez zmian strukturalnych (`customAppItems`, sync globalny).

## Konsekwencje

- **Pozytywne:** max. 2 kliknięcia od mapy do edytora; spójne deep-linki; przygotowanie pod moduły F2–4 (decisions, campaigns, geo) jako kolejne zakładki w obszarach.
- **Negatywne:** tymczasowe duplikaty montowania stron (komponenty w starych folderach, trasy w nowych) do czasu pełnego przeniesienia plików; placeholdery `market/journey` i `market/segmentation` redirectują do segmentów do Fazy 3.
- **Migracja:** `health-score` i `strategy-map` czytają href z `projectModuleHref()` — linki w Canvas/mapie wskazują nowe trasy.

## Alternatywy odrzucone

- **Query-param tabs** (`?tab=brand`) — gorsze SSR/deep-link niż pod-route segmenty.
- **Middleware redirect** — mniej czytelne przy debugowaniu niż jawne `redirect()` w starych `page.tsx`.
- **Usunięcie starych tras od razu** — łamałoby zakładki i linki zewnętrzne.
