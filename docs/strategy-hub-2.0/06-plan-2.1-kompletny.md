# Strategy Hub 2.1 — kompletny plan zgodności ze specyfikacją (master)

> **Jedno źródło prawdy** dla dalszej pracy. Scala: (a) plan z Cursora `strategy_hub_spec_compliance` (fazy 0–17), (b) 7 poprawek z audytu zgodności, (c) realny stan repo zweryfikowany w kodzie. Zastępuje rozproszone notatki — fazy 0–9 z `05-plan-wdrozenia.md` traktujemy jako **baseline (w większości wdrożone)**, ten dokument to ich rewizja + domknięcie do pełnej zgodności z Notion.
>
> Specyfikacja produktowa: Notion „Strategy Hub" (4 dokumenty: Strategia / Dokumentacja techniczna / Logika modułów / Notatki).
> Podejście: **inkrementalna migracja, bez big-bang rebuildu.** Każda faza zostawia aplikację działającą i kończy się bramką jakości.

## 0. Werdykt i zasada nadrzędna

Kod **już jest** implementacją tej specyfikacji (lokalny plan 0–9 wyprowadzony 1:1 z Notion, większość wdrożona). Dlatego **nie przepisujemy od zera** — domykamy luki i rozbieżności. Dyscyplina ze spec: *„Lista modułów zamknięta — dokładnie te moduły, nic więcej"* (uwaga na scope-creep).

## 1. Stan zastany (zweryfikowany w kodzie — 2026-07)

| Obszar | Stan | Dowód |
|---|---|---|
| Nawigacja 5 obszarów + Mapa firmy (ekran zerowy) | ✅ | `area-routes.ts`, `nav-sidebar.tsx` |
| Rejestr encji (≈35) + dynamiczny dispatch API | ✅ | `lib/strategy-hub/entities/*`, `app/api/strategy-hub/projects/[id]/[entity]/route.ts` |
| Tabele 2.0 (sites, decisions+links, campaigns, geo, offers, comments, ruleSets) | ✅ | `db/schema.ts` (migracje 0011–0014) |
| Silnik reguł — konfiguracja (lock/stale/correlations/alerts/palette/presentationOrder) | ✅ schema | `rules/types.ts` ma już `lock.requiresUpstream`, `stale`, `correlations.required` |
| Health-score config-driven | ✅ | `rules/evaluate.ts` (count_gte/field_filled/custom) |
| Strategy Map (Lista/Mapa/Graf wpływu), ścieżki (`strategyPaths`), komentarze, weekly review, alerty, digest, onboarding, compare | ✅ ⚠️ | komponenty obecne; głębia do dopięcia |
| **Kolejka propozycji AI `ai_proposals` + agent 4-tryby** | ❌ | brak tabeli i mechanizmu |
| **MCP 45 narzędzi (16/22/7)** | ⚠️ | ~13–26 tooli; brak 7 AI-workflow |
| **Słownik zdarzeń analityki (pakiet + `event_key` + `funnel_element_events`)** | ❌ | brak |
| **Eksporty `export_jobs`/`delivery_log` (pełna strategia/PNG/DOCX/JSON)** | ⚠️ | tylko `business/pdf` |
| **Realtime <5 s** | ❌ | sidebar = `fetch` polling |
| **Dashboard klienta** | ⚠️ legacy | `/projects/[slug]` czyta z **Sanity** (`@/sanity/queries`), nie z Postgres |
| **Stary portal Sanity + Prisma** | ❌ do wygaszenia | `app/(sanity)/studio`, `sanity/`, `prisma/`, build = `prisma generate && next build` |
| Junctiony kampanii/ofert (channels/kpis, funnel/pages) | ⚠️ | `campaigns.channels` jako jsonb; brak `campaign_kpis`, `offer_funnel_elements`, `offer_pages` |
| Model ścieżek | ⚠️ rozbieżność | `strategyPaths` + nullable `path_id` zamiast `strategy_tracks`+`track_entities` (owned/shared) |

Stack: Next.js 16 (App Router) + React 19, Drizzle ORM (Postgres), zod v4, shadcn/`@base-ui`, Tailwind v4, Motion, React Flow (`@xyflow/react`), `@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`, `@react-pdf/renderer`, `@supabase/supabase-js`, Resend, cmdk — **wszystkie kluczowe biblioteki już zainstalowane**. Brakuje tylko `@notionhq/client` (sync używa raw fetch).

## 2. Siedem poprawek względem planu z Cursora (wplecione w fazy)

1. **Reguły: rozszerzać `lib/strategy-hub/rules/`, nie tworzyć `rules-engine.ts`.** Config (`rules/types.ts`) już ma lock/stale/correlations. Faza R = dopełnić `defaults.ts` (13 locków + kryteria „✅ gdy" wszystkich modułów), dodać propagację `review_flag` w `rules/resolve.ts`/zapisach, **unit-testy**.
2. **Faza 0a „inwentaryzacja per-moduł"** przed budową — lista „gotowe vs stub" dla każdego ekranu (połowa faz 1–9 już częściowo żyje).
3. **Import RetroHouse/Lumine zaraz po data-modelu** (nie na końcu) — walidacja modelu na realnych danych (shift-left).
4. **Dashboard klienta + eksporty wcześniej** (M2, nie końcówka) — wartość dla klienta + dogfooding „agencja-first".
5. **Jawne wygaszenie Sanity + Prisma** — `/projects/[slug]` przepisać na Postgres (`mode="client"`), usunąć `sanity/`, `prisma/`, Studio; build bez `prisma generate`.
6. **Strategy Canvas (12 kafelków) jako osobny punkt** weryfikacji/uzupełnienia (`canvas/page.tsx`, `canvas-data.ts`).
7. **Testy + 5 flow jako bramki kolejnych milestone'ów** (nie tylko typecheck/lint/build): unit-testy reguł w M1, walidacja flow A–E rozłożona na M2–M4.

## 3. Świadome odstępstwa od spec (zatwierdzone)

- **REST zamiast tRPC** — zostaje (dynamiczny dispatch działa).
- **`strategyPaths` (single `path_id`) + warstwa `track_entities` (N:N, owned/shared)** zamiast pełnego `strategy_tracks` — hybryda: zachowujemy istniejące, dokładamy N:N + backfill (bez rename, bez utraty danych).
- **Realtime: Supabase channels** tylko jeśli DB jest na Supabase; inaczej **SSE/`revalidateTag`** (Neon/Vercel PG). Cel: <5 s.
- **RLS przy custom JWT:** egzekucja aplikacyjna (`context.ts`/`assertProjectAccess`) + opcjonalne Postgres RLS przez `set_config(app.workspace_id)`.
- **„Głębia strategiczna" (drabina wartości, messaging, pipeline B2B, framing wroga, ICP vs segment)** = backlog v2.1+, **poza definicją zgodności** (spec: lista zamknięta).
- **Nazwy tabel** istniejące zachowujemy (`strategy_paths`, `offers`, `strategic_decisions`) + dokładamy junctiony.

## 4. Milestone'y i mapowanie faz

Ta sama treść co plan Cursora 0–17, przeorganizowana: walidacja na realnych danych z przodu, wartość kliencka w środku, legacy-cleanup jako jawny punkt, bramki go/no-go.

| Milestone | Fazy | Bramka go/no-go |
|---|---|---|
| **M0 — Fundament danych** | 0a inwentaryzacja → **0 data-model + migracja 0015** → import RetroHouse/Lumine | model zwalidowany na realnych danych; build zielony |
| **M1 — Zgodność rdzenia** | R reguły(+testy) → RP RelationPicker → SM Strategy Map(+prezentacja+edycja na mapie) → KC 8 komponentów → MP market/journey+segmentation → CV Canvas 12 kafelków | edycja relacyjna + mapa 1:1 ze spec; testy reguł zielone |
| **M2 — Wartość kliencka** | EX eksporty(+JSON) → CD dashboard klienta na Postgres + **wygaszenie Sanity/Prisma** → MON health/weekly/alerty/digest | klient widzi dashboard; flow C (prezentacja) i A (KPI) przechodzą |
| **M3 — AI + analityka** | AI agent 4-tryby + `ai_proposals` → AN analytics-events + `event_key` → MCP 45 narzędzi → CP Cmd+K/Cmd+J + skróty → UX wzorce (komentarze/timeline/bulk/inline) | „zero direct write"; flow B (obiekcja+dowód) i E (Notion AI→MCP) przechodzą |
| **M4 — SaaS + sync + polish** | SY sync Notion 2-way (@notionhq/client) → SAAS role/RLS/white-label/realtime → POL walidacja 5 flow + a11y/CWV | flow D (onboarding 10 min) przechodzi; CWV i a11y spełnione |

### Mapowanie na fazy Cursora
M0 = Faza 0 (+0a, +17 importy przeniesione z tyłu). M1 = Fazy 1–6 (Faza 1 → „R", z poprawką #1). M2 = Fazy 14, 16, 8 (+wygaszenie legacy). M3 = Fazy 10, 11, 12, 9, 7. M4 = Fazy 13, 15, 17(walidacja).

## 5. Faza 0 — data-model (szczegóły implementacji)

Migracja `db/migrations/0015_spec_compliance.sql` (wszystko nullable/`default` → bezpieczne i odwracalne):

**Nowe tabele:**
- `ai_proposals` (id, project_id, mode `audit|research|improve|monitor`, entity_type, entity_id?, diff jsonb, rationale_md, sources jsonb, status `pending|accepted|rejected|expired`, created_at, resolved_at, resolved_by)
- `export_jobs` (id, project_id, type `pdf_full|pdf_report|docx|md|png_map|svg_graph|json`, status, file_id, created_at)
- `delivery_log` (id, project_id, export_job_id?, recipient_email, sent_at, opened_at, channel)
- `funnel_element_events` (funnel_element_id, event_key, is_conversion, PK złożony)
- `track_entities` (id, track_id→strategy_paths, entity_type, entity_id, relation `owned|shared`) + backfill z istniejącego `path_id`
- `campaign_channels` (campaign_id, channel_id), `campaign_kpis` (campaign_id, kpi_id)
- `offer_funnel_elements` (offer_id, funnel_element_id), `offer_pages` (offer_id, page_id)
- `workspace_branding` (workspace_id PK, logo_file_id, colors jsonb, custom_domain, email_from, status)

**Nowe kolumny:**
- `kpis.event_key` (text, null = nie-analityczny)
- `review_flag` (boolean default false) na encjach strategicznych kluczowych dla propagacji (segments, objections, funnel_elements, kpis, pages, strategic_decisions — etap 1)
- `projects.graph_layout` (jsonb) — układ grafu relacji

`users.role` pozostaje `varchar` — rozszerzamy **zestaw wartości** (`agency_owner|agency_member|client_viewer|client_editor`) bez zmiany schematu (egzekucja w `context.ts`, M4).

## 6. Definicja gotowości (per faza)

- [ ] `pnpm typecheck` (TS strict, brak `any`) · `pnpm lint` · `pnpm build` zielone.
- [ ] Migracje aplikowalne i odwracalne (każda nowa kolumna nullable/default).
- [ ] Brak regresji health-score (seed reguł = obecne wartości).
- [ ] Nowe interaktywne: focus-visible/aria; `prefers-reduced-motion` wyłącza animacje mapy.
- [ ] Custom Apps (Liczenie godzin) działają identycznie.
- [ ] ADR dla nietrywialnych decyzji (`docs/adr/NNN-*.md`).
- [ ] (od M1) unit-testy reguł zielone; (M2–M4) odpowiednie flow A–E przechodzą.

## 7. Kryteria sukcesu (ze spec)

- RetroHouse + Lumine zmigrowane 1:1 (8 modułów + segmenty + lejki + materiały + strona).
- Klienci widzą dashboard na `syntance.dev`; wygląda jak produkt agencji premium.
- Notion AI przez MCP: pobranie strategii, dodanie segmentu z lejkiem, aktualizacja obiekcji, generowanie sekcji podstrony.
- Zmiana w dowolnym źródle (Hub / Notion / MCP) propaguje się do pozostałych < 5 s.
- Codzienne użycie zamiast Notion w warstwie strategii.

---

## Aneks A — pełna treść planu Cursora „strategy_hub_spec_compliance" (fazy 0–17, szczegóły źródłowe)

> Zachowane w całości jako referencja wykonawcza. Sekcje 4–6 wyżej to **warstwa zarządcza** (M0–M4, poprawki, odstępstwa) zbudowana na tej treści po zweryfikowaniu jej w kodzie. W razie sprzeczności między Aneksem A a sekcjami 1–6 wygrywają sekcje 1–6 (są nowsze i code-verified).

### Naprawy wad z audytu Notion (wplecione w fazy Aneksu)
- Realtime: decyzja Supabase vs SSE/polling (Faza 15 / M4).
- RLS przy custom JWT: egzekucja aplikacyjna + opcjonalne RLS przez `set_config` (Faza 15 / M4).
- tRPC: zostajemy przy REST jako świadome odstępstwo.
- Głębia Negacza: drabina wartości, messaging, pipeline B2B, ICP vs segment, framing wroga (Faza 17 — backlog v2.1+, poza definicją zgodności).
- Redundancja `buyer_journey_stages` vs `purchase_stages`: jasny podział ról (Faza 1 + 5).
- Pakiet analytics konsumowalny samodzielnie (Faza 11 / M3).
- Konflikty Notion: Hub wygrywa + twardy log (Faza 13 / M4).
- Odstępstwo nawigacji (Discovery w Fundamencie, Dostępy w „Informacja i notatki") — zachowane świadomie na życzenie właściciela produktu, priorytet nad spec.

### Faza 0 — Domknięcie data modelu
Migracje Drizzle w `db/schema.ts` + `db/migrations/` (patrz też §5 wyżej — migracja `0015_spec_compliance.sql` to operacyjna wersja tej fazy):
- Brakujące tabele: `workspace_branding`, `track_entities` (N:N encja-ścieżka, relation owned/shared), `campaign_channels`, `campaign_kpis`, `offer_funnel_elements`, `offer_pages`, `ai_proposals`, `export_jobs`, `delivery_log`, `funnel_element_events`.
- Brakujące kolumny: `kpis.event_key`, `kpis.owner_type`/`owner_id`, `review_flag` (boolean) na encjach strategicznych, `projects.graph_layout` (jsonb), rozszerzenie `users.role` o `agency_owner|agency_member|client_viewer|client_editor`.
- Jawne FK tam gdzie brak: `competitors.segmentId`, `objections.segmentId`, `userFlows.entryElementId`, `navItems.parentId`.
- Migracja danych: `campaigns.channels` (jsonb) → `campaign_channels`; zachowanie `pathId` (single) + dodanie warstwy `track_entities` (N:N + shared); backfill `track_entities` z istniejącego `pathId`.
- Rozdzielenie ról: `buyer_journey_stages` = mapa myśli (co robi klient/czas/nasze działanie); `purchase_stages` = TOFU/MOFU/BOFU/Retencja (trigger/obiekcje/emocje/pytania). Dokumentacja w kodzie + UI.

### Faza 1 — Silnik reguł (serce specyfikacji)
Rozszerzenie `lib/strategy-hub/rules/` (NIE nowy `rules-engine.ts` — patrz poprawka #1 w §2 wyżej):
- Maszyna stanów per encja/moduł: pusty / do-przeglądu / gotowy. Kryteria „✅ gdy" skodyfikowane z dokumentu logiki dla KAŻDEGO modułu (Discovery, Marka, Biznes, Segmenty, Lejek, Kanały, Copy, KPI, Strona, Hosting, Decyzje, Kampanie, GEO, Oferta, Ścieżki, Multi-site).
- Lock upstream→downstream wg pełnej „Macierzy krytycznych zależności" (13 reguł: UVP wymaga Problemy+Konkurencja; Segmenty wymagają Kryteria+Rynek; Buyer journey wymaga Segment; Etapy+Elementy wymagają Buyer journey+Obiekcje; Mapa kanałów wymaga Segmenty+Etapy; Pitche wymagają Segment+UVP+Obiekcje; Mapa serwisu wymaga Segmenty+Lejek+Obiekcje; Sekcje wymagają Rola+Segment+Obiekcje; SEO wymaga Lejek+Mapa serwisu; KPI wymaga Segment+Lejek+Kanały; Kampania wymaga Elementy+Segment+Kanały+Oferta; GEO wymaga Mapa serwisu+SEO; Oferta wymaga UVP+Segmenty; Rejestr decyzji wymaga przyczyna+dowód).
- Downstream zablokowany = wyszarzony + „Najpierw uzupełnij X".
- Propagacja „do przeglądu": zmiana gotowej encji X → wszystkie moduły z X w „Wejściach" dostają `review_flag` (pulsują). Zmiana strategiczna (nie kosmetyczna) → propozycja wpisu w Rejestrze decyzji z linkami do skutków.
- Łańcuch wpływu + czerwona ramka „niepodłączony": element lejka bez ≥1 relacji downstream (user flow/podstrona/KPI); KPI analytics bez `event_key`; kampania/GEO bez podpięcia.
- Ścieżki: reguły wejść/wyjść obowiązują w obrębie ścieżki; encja shared musi spełniać reguły w każdej ścieżce. Multi-site: warstwa strony zawsze pod konkretną site.
- Wpięcie statusów w `nav-sidebar`, `strategy-map/list-view`, `map-view`, Strategy Canvas, `health-ring`.
- **Wymóg dodatkowy (M1):** unit-testy reguł (13 locków + kryteria „gdy") — bramka wyjścia z M1.

### Faza 2 — RelationPicker (pełny kontrakt) + macierz relacji per encja
- Rozszerzenie `components/strategy-hub/relation-picker.tsx` o WSZYSTKIE 9 funkcji ze spec: search fuzzy (z podświetleniem matcha), single/multi-select, filtr po kontekście (`filterBySegmentId/StageId/Phase`), podgląd encji na hover (mini-karta), „+ Utwórz nowy [encja]" inline, sugestie AI u góry listy (badge „Polecane na podstawie..."), bulk select, drag-reorder chipów, skok do encji (strzałka → panel obok), nawigacja klawiaturą (góra/dół, Enter, Backspace, Esc).
- Kontrakt typu `RelationPickerProps<T>` zgodny ze spec (entityType pełna lista, cardinality, filterBy*, aiContext, allowCreate, disabledIds, sortable).
- Macierz „która encja ma jakie pickery" — sekcja „Powiązania" w edytorze KAŻDEJ encji: relacje wychodzące (single+multi) + relacje wsteczne (read-only) wg tabeli ze spec.
- Reguły spójności pickerów: save-block dla wymaganych; zmiana segmentu czyści picker etapu; SEO keyword jeden target page; soft-delete z relacjami → dialog „usuń/odepnij/anuluj".

### Faza 3 — Graf relacji projektu + edycja na mapie firmy
- Widok Cmd+K „Graf relacji projektu" (`components/strategy-hub/strategy-map/relation-graph.tsx`): React Flow ze WSZYSTKIMI encjami projektu jako węzły, krawędzie kolorowane wg typu, filtr widoków, klik węzła → side panel z edytorem, layout zapisany w `projects.graph_layout`, eksport PNG/SVG.
- Edycja na mapie (map-first) w `map-view.tsx`: oś Fundament → Rynek → Lejek → Egzekucja → Pomiar; „+" w kolumnie/na porcie → karta-edytor bez opuszczania mapy; przeciąganie portu = podpięcie upstream/downstream; brak relacji = czerwona ramka.
- Inline relacje w tabelach: kolumny Etap/Segment/Kanały/KPI/Flows w tabeli elementów lejka jako pickery inline.

### Faza 4 — Strategy Map: 3 widoki + tryb prezentacji + graf wpływu
- Widok 1 Lista: outline ze statusami (dopiąć stany z Fazy 1).
- Widok 2 Strategy Map (makro, 7 węzłów, FIXED layout): mechanika 3 poziomów (L1→L2 stagger 40ms, L2→karta in-place layoutId), tylko jeden L1 rozwinięty naraz.
- Tryb Prezentacja (autopilot): `presentationOrder` kanoniczny, pasek „krok X/7".
- Widok 3 Graf wpływu (mikro, 3-strefowy): PRZYCZYNA → OŚ (element lejka) → SKUTEK, krawędzie etykietowane semantycznie, przełącznik kolorowania [typ]↔[faza], tryb skupienia, filtry, ścieżka wstecz, czerwona ramka.
- Tryby editor vs client; ścieżki strategii (przełącznik + porównanie side-by-side).

### Faza 5 — 8 interaktywnych komponentów kluczowych
1. Positioning Quadrant (drag&drop, auto-snap 5×5, eksport PNG/SVG).
2. Funnel Flow Builder (4 kolumny TOFU/MOFU/BOFU/Retencja, drag-to-link, auto-layout Cmd+L).
3. Channel Heatmap 3D (kanał × segment × etap).
4. Segment Cards (tabbed, 7 sekcji accordion, quick action „Generuj lejek").
5. Objections Drill (split view, AI „Zaproponuj dowód").
6. Page Section Editor (split schema+live preview, „Wyślij do dev").
7. KPI Live Dashboard (sparkline 30d, czerwony pasek <80% targetu).
8. Buyer Journey Table + „Przekuć na lejek" (promote-to-funnel).

### Faza 6 — Realne strony market/journey i market/segmentation
- `market/journey`: Buyer Journey Table per segment + promote-to-funnel (zamiast redirect).
- `market/segmentation`: konfigurator kryteriów (wagi wg Negacza) + macierz scoringu + priorytetyzacja segmentów (zamiast redirect).

### Faza 7 — Wzorce UX
Komentarze per encja (mentions + email), side-by-side compare (Cmd+Shift+C), last-update badges, quick AI actions (Cmd+/), version timeline (diff+restore), bulk actions, inline edit (autosave 300ms + undo/redo sesyjne), empty states / first-run („Zaimportuj z Notion").

### Faza 8 — Monitoring i egzekwowanie strategii
Health Score per moduł z formułami ze spec (widoczne na Canvas/sidebar/liście projektów/Dashboard klienta), weekly review (Cmd+Shift+R, diff 7 dni), alerty (KPI/domena/sync/wizyta), email digest (Resend).

### Faza 9 — Command Palette + skróty klawiszowe
Cmd+K pełne akcje (w tym „Pokaż graf relacji projektu", „Sync z Notion teraz", „Eksportuj jako PDF"); skróty Cmd+K/J/P/,/Shift+R/Shift+C/Z/Shift+Z/`/`, vim-style `G S`/`G L`/`G W`/`G C`.

### Faza 10 — AI Sidekick 3 zakładki + agent 4 tryby + kolejka propozycji
Sidekick (Sugestie/Chat/Analizy) z „wstaw do sekcji X"; agent 4 tryby (Audyt/Research/Poprawa/Monitoring); kolejka `ai_proposals` (pending→accept diff→apply source='ai', TWARDA zasada zero-direct-write); persona „przewodnik" dla klienta.

### Faza 11 — Wiązanie analityki (oś Pomiar)
`packages/analytics-events` + `EVENT_REGISTRY` (konsumowalny samodzielnie); `kpis.event_key` + `funnel_element_events`; RelationPicker `analytics_event`; reguły mierzalności KPI/CTA; `.cursor/rules/analytics.mdc`.

### Faza 12 — MCP server: 45 narzędzi
16 read + 22 write + 7 AI workflow tools (pełna lista nazw w oryginalnym planie Cursora) + tools relacyjne (`hub_link_element_to_channel`, `hub_suggest_relations`, `hub_promote_to_funnel`, `hub_list_analytics_events`).

### Faza 13 — Dwukierunkowy sync z Notion (utwardzenie)
`@notionhq/client` zamiast raw fetch; Vercel Cron worker push wszystkich modułów; webhook `/strategy-hub/api/webhooks/notion` (alias) z `source='notion'`; anti-loop hash+source; konflikt → Hub wygrywa + log severity.

### Faza 14 — Eksporty i wysyłka
PDF pełny + raport okresowy; PNG/SVG (mapa, graf wpływu, quadrant); DOCX/Markdown; JSON pełny; `export_jobs`; Resend „Wyślij klientowi" + `delivery_log`.

### Faza 15 — SaaS: role, RLS, white-label, Realtime, perf
Role SaaS + egzekucja; `workspace_branding` white-label; RLS (aplikacyjne + opcjonalne `set_config`); Realtime (Supabase lub SSE/polling); budżety perf (<200KB JS, LCP<1.5s, wirtualizacja, lazy-load); etapowanie agencja-first.

### Faza 16 — Dashboard klienta + onboarding + design system
12 sekcji read-only na Postgres (nie Sanity — patrz poprawka #5 w §2); onboarding wizard 7 kroków; design system (typografia/kolory OKLCH/dark mode/komponenty custom/mikrointerakcje/responsywność).

### Faza 17 — Importy + głębia strategiczna + weryfikacja
Import RetroHouse (notion-86) i Lumine (notion-875) — przeniesione na start (M0) wg poprawki #3; głębia strategiczna Negacza (drabina wartości, messaging, pipeline B2B, ICP vs segment, framing wroga) jako backlog v2.1+; walidacja 5 krytycznych flow A–E.

### Weryfikacja (po KAŻDEJ fazie, z oryginalnego planu)
`pnpm typecheck && pnpm lint && pnpm build`; migracje `drizzle-kit generate` + apply; smoke-test kluczowych tras. Po całości: checklista 100% pokrycia elementów z 3 dokumentów Notion.
