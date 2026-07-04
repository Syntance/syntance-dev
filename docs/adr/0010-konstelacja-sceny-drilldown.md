# ADR 0010: Konstelacja — sceny drill-down zamiast jednego grafu

## Status

Zaakceptowane (2026-07)

## Kontekst

Konstelacja 1.0 renderowała jeden radialny graf (rdzeń → 7 obszarów → encje) jako tryb w switcherze Mapy firmy. Użytkownicy potrzebują pełnoekranowego widoku z drill-down: organizm → obszar → element, z kolumnami upstream/downstream na poziomach area i entity (referencja: alassafi.ai).

Równolegle domknięto pokrycie grafu strategii o typy K1 (`sales_pitch`, `sales_script`, `lead_magnet`, `section`, `geo_query`, `site`).

## Decyzja

1. **Osobna strona** — `/strategy-hub/projects/[id]/constellation` (edytor) i `/projects/[slug]/strategy/constellation` (portal klienta). Pełny viewport minus header Hub; pozycja „Konstelacja" w nav-sidebar między Mapą firmy a Canvas.
2. **Sceny zamiast jednego grafu** — read-model `getConstellationScene` zwraca `SceneData`: `center`, `members`, `upstream`, `downstream`, `links`, `breadcrumb`. Trzy poziomy: `organism` | `area` | `entity`. Stan w URL (`?level=&area=&type=&id=` lub skrót `?focus=type:id`).
3. **Kierunek przyczyna → skutek** — krawędzie FK i `entity_relations` derywowane z konwencją source=przyczyna, target=skutek. Upstream/downstream liczone z krawędzi cross + `AREA_DEPENDENCIES` na poziomie obszaru.
4. **AREA_DEPENDENCIES** — zsynchronizowane z upstream locks w `rules/defaults.ts` (np. `lejek: ["segmenty"]`, `strona: ["lejek", "przekaz"]`).
5. **Wykluczenia operacyjne** — encje typu questions, glossary, credentials, materials, notes, tasks itd. nie wchodzą do grafu strategii (komentarz w `entity-types.ts`).
6. **Singletony rdzenia** — UVP i pozycjonowanie nie są węzłami; treść w panelu bocznym po kliknięciu rdzenia (organism).
7. **Panel encji** — otwierany na żądanie (Enter / „Szczegóły"), nie przy każdym kliknięciu węzła.
8. **Narzędzia AI** — `get_neighbors` i `semantic_search` korzystają z dynamicznego `ENTITY_TYPE_META` / indeksu embeddingów; nowe typy K1 są objęte bez dodatkowego whitelistu.

## Konsekwencje

- Switcher Mapy firmy: lista / mapa / pipeline (+ link do Konstelacji). Deep-link `?view=constellation` → redirect na stronę konstelacji.
- `focus_map_node` z czatu nawiguje do sceny entity (`/constellation?focus=`).
- Lazy chunk `ConstellationView` (ssr:false) — initial route konstelacji poniżej budżetu JS.
- `prefers-reduced-motion` wyłącza spring kamery (`use-camera`).
- ADR 0009 pozostaje ważny dla warstwy render (SVG + Motion); ten ADR rozszerza model danych i nawigację.
