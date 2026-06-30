# ADR 0001 — Silnik reguł Strategy Hub (JSONB)

## Status

Zaakceptowany (Faza 0 Strategy Hub 2.0)

## Kontekst

Logika kompletności modułów (health-score), zależności makro mapy (krawędzie, kolejność prezentacji) oraz semantyka grafu wpływu (etykiety korelacji, walidacja „niepodłączony") była zahardkodowana w `health-score.ts`, `strategy-map.ts` i `strategy-map-types.ts`. Strategy Hub 2.0 wymaga edytowalnych reguł per workspace/projekt bez regresji względem obecnego zachowania.

## Decyzja

1. **Tabela `strategy_rule_sets`** — jeden rekord na `scope` (`global` lub `projectId`), pole `config` typu JSONB z walidacją Zod (`RulesConfigSchema`).
2. **Resolver `resolveRules(projectId?)`** — `deepMerge(DEFAULT_RULES, global, projectOverride)` + parse Zod; cache per request (`React.cache`).
3. **`DEFAULT_RULES`** w kodzie — 1:1 z dotychczasowym hardcode; seed DB wstawia ten sam JSON idempotentnie.
4. **Konsumenci** — `health-score.ts` i `strategy-map.ts` czytają konfigurację z resolvera; UI bez zmian w Fazie 0.

## Konsekwencje

- **Pozytywne:** jeden źródłowy kontrakt reguł; przygotowanie pod UI ustawień (Faza 5); override per projekt bez migracji schematu.
- **Negatywne:** JSONB wymaga ścisłej walidacji przy zapisie (Faza 5); merge tablic nadpisuje całość (świadomy kompromis — override projektu zastępuje listy, nie append).
- **Bezpieczeństwo:** brak rekordu globalnego → fallback do `DEFAULT_RULES`; niepoprawny JSON po merge → `RulesConfigSchema.parse` odrzuca (w resolverze przy odczycie z DB w Fazie 5 zapis walidowany w server action).

## Alternatywy odrzucone

- **Osobne tabele per typ reguły** — zbyt sztywne przy ewolucji modułów 2.0.
- **Tylko kod bez DB w Fazie 0** — odrzucone; Faza 0 wymaga migracji i seedu pod Fazę 5.
