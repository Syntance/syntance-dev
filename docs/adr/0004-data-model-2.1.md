# ADR 0004 — Domknięcie data-modelu pod zgodność ze spec (Strategy Hub 2.1)

**Status:** Zaakceptowany · **Data:** 2026-07-01 · Migracja: `db/migrations/0015_spec_compliance.sql`

## Kontekst

Audyt zgodności kodu ze specyfikacją Notion (4 dokumenty) wykazał, że warstwa danych pokrywa
większość modułów 2.0, ale brakuje tabel/kolumn pod: kolejkę propozycji AI (zero direct write),
słownik zdarzeń analityki, eksporty, white-label oraz pełne relacje N:N kampanii/ofert i ścieżek.
Konwencja repo: ręcznie pisane, idempotentne migracje SQL (`IF NOT EXISTS`, FK w `DO $$ ... EXCEPTION`),
journal/meta drizzle **nieużywany** (jedyny wpis = 0000).

## Decyzja

Migracja `0015` (addytywna, odwracalna) dodaje:

- **Tabele:** `ai_proposals`, `export_jobs`, `delivery_log`, `funnel_element_events`, `track_entities`,
  `campaign_channels`, `campaign_kpis`, `offer_funnel_elements`, `offer_pages`, `workspace_branding`.
- **Kolumny:** `kpis.event_key`, `projects.graph_layout`, `review_flag` na encjach kluczowych dla
  propagacji „do przeglądu" (`segments`, `objections`, `funnel_elements`, `pages`, `kpis`, `strategic_decisions`).

Świadome decyzje:

1. **Ścieżki: hybryda, bez rename.** Zachowujemy `strategy_paths` + single `path_id` (działa) i dokładamy
   `track_entities` (N:N, `relation = owned|shared`) — by encja mogła należeć do wielu ścieżek z rolą.
   Backfill z `path_id` należy do warstwy track (M1), gdy ustalimy słownik `entity_type` — nie zgadujemy go w migracji.
2. **`event_key` nie jest FK.** Walidowany Zod enumem zbudowanym z pakietu `@syntance/analytics-events`
   (M3) — pakiet pozostaje jedynym źródłem prawdy słownika; baza tylko referuje klucz.
3. **`users.role` bez zmiany schematu** — rozszerzamy zestaw wartości (`agency_*`/`client_*`) i egzekwujemy
   aplikacyjnie (M4), nie wymuszamy enuma w DB.
4. **`review_flag` jako kolumna**, nie wyliczana — pozwala tanio pulsować „do przeglądu" i filtrować w SQL;
   ustawiana przez propagację reguł przy zapisie upstream (M1).

## Konsekwencje

- Odblokowane fazy: AI/proposals (M3), analityka (M3), eksporty (M2), white-label (M4), junctiony (M1).
- `campaigns.channels` (jsonb) i `offer_segments` zostają — migracja danych jsonb→junction nastąpi w M1
  przy budowie endpointów relacji (na razie współistnieją).
- Brak regresji: wszystko `IF NOT EXISTS`/`DEFAULT`; `tsc --noEmit` = 0 błędów po zmianie.
- Dług: snapshot meta drizzle pozostaje nieaktualny (zgodnie z konwencją repo — migracje ręczne).
