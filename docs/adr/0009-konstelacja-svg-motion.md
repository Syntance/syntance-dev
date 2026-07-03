# ADR 0009: Widok Konstelacji (SVG + Motion)

## Status

Zaakceptowane (2026-07)

## Kontekst

Strategy Map miała trzy widoki (lista, mapa liniowa, graf wpływu). Potrzebny był czwarty widok — holistyczna „konstelacja" strategii per projekt, czytelna w portalu klienta (read-only) i w edytorze.

## Decyzja

1. **Render** — własny SVG + Motion (pan/zoom, spring focus), bez React Flow (oszczędność bundla; React Flow zostaje w grafie relacji).
2. **Layout** — `d3-hierarchy` tree w układzie polarnym: rdzeń → 7 obszarów → encje.
3. **Dane** — read-model `getConstellationData` + GET `/constellation`; cross-linki z `entity_relations`.
4. **Portal klienta** — domyślny widok Konstelacja; filtrowanie przez `visibility.ts` w read-modelu (`mode=client`).
5. **LOD** — etykiety encji od zoom ≥ 0.9; cross-linki od ≥ 0.7 lub przy fokusie węzła.

## Konsekwencje

- Lazy chunk (`dynamic` ssr:false) — initial route strategy-map poniżej budżetu JS.
- Ciemne tło scope'owane na kontener widoku — bez zmiany globalnego motywu.
- Klawiatura + `prefers-reduced-motion` (kamera bez spring).
