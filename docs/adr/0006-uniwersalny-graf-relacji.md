# ADR 0006: Uniwersalny graf relacji

## Status

Zaakceptowane (2026-07)

## Kontekst

Strategy Hub utrzymywał relacje semantyczne w sześciu tabelach join (`funnel_element_channels`, `funnel_element_kpis`, itd.). Każda nowa relacja wymagała migracji schematu i osobnych route'ów zapisu.

## Decyzja

1. **Relacje semantyczne** — jedna tabela `entity_relations` z polimorficznymi `(source_type, source_id)` → `(target_type, target_id)` + `relation_type`.
2. **Relacje strukturalne** (FK: `funnelElements.stageId`, `kpis.segmentId`, `seoKeywords.targetPageId`) — pozostają w tabelach typowanych; derywowane do grafu przy odczycie.
3. **Brak FK** na kolumnach polimorficznych — walidacja typów przez Zod + katalog `ENTITY_TYPE_META`; sieroty sprząta cron agenta (Faza C).
4. **Indeks unikalny** częściowy `WHERE deleted_at IS NULL` — duplikaty aktywnych relacji blokowane w aplikacji (SELECT przed INSERT).

## Konsekwencje

- Seed idempotentny z join-tabel przed DROP.
- `trackChange` na każdym zapisie relacji → SSE odświeża graf.
- UI grafu (`RelationGraphData`) bez zmiany kształtu — tylko źródło krawędzi semantycznych.
