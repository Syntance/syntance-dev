# ADR 0003 — Rejestr decyzji z polimorficznymi linkami

## Status

Zaakceptowane (Faza 3 Strategy Hub 2.0)

## Kontekst

Potrzebujemy uzasadniać decyzje strategiczne i pokazywać je na Mapie firmy (overlay „dlaczego tak?" + ścieżka wstecz). Encje docelowe mają różne typy (segment, page, KPI, …).

## Decyzja

- Tabele `strategic_decisions` + `decision_links` z polimorficznym `entityType` + `entityId` (bez FK na encję docelową).
- Walidacja typu po stronie aplikacji (RelationPicker + API PUT links).
- Endpoint `GET /decision-trail?entityType=&entityId=` dla overlay na mapie.

## Konsekwencje

- Elastyczność — nowe typy encji bez migracji FK.
- Brak integralności referencyjnej DB; soft-delete encji wymaga orphan links (akceptowalne w MVP).
- Overlay mapy używa UUID z kart L3 (tylko encje z prawdziwym id).
