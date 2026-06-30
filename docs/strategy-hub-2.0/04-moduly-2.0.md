# 04 — Moduły 2.0 (spec UI/UX)

Zasady wspólne dla wszystkich modułów: inline edit + auto-save (300 ms debounce, optimistic), `sparkle` AI button per sekcja (Cmd+/), last-update badge, komentarze per encja, reuse istniejących komponentów (`entity-crud`, `entity-editor`, `relation-picker`, `tiptap-editor`, `data` z shadcn). RSC domyślnie; `"use client"` tylko dla interakcji.

Reuse komponentów (z [components/strategy-hub/](components/strategy-hub/)): `EntityCrud`, `EntityEditor`, `EntitySingleton`, `RelationPicker`, `OptionCombobox`, `ListItemsEditor`, `JsonListEditor`, `TiptapEditor`, `FunnelFlow`, `HealthRing`, `Sparkline`, `StrategyMap`.

---

## 1. Rejestr decyzji (Fundament) — Faza 3

Encje: `strategicDecisions` + `decisionLinks` (`02-model-danych.md`).

UI: trasa `/foundation/decisions`. Widoki:
- **Tabela** decyzji: tytuł, status (active/revised/withdrawn — badge), autor (human/ai), data, liczba powiązań cause/effect.
- **Edytor decyzji** (inline): tytuł, `reasonMd` (przyczyna, Tiptap), `evidenceMd` (dowód/research), status, autor. Sekcje powiązań: `RelationPicker` osobno dla cause (upstream encje, które uzasadniają) i effect (downstream encje, na które wpływa).
- **Oś czasu**: chronologiczny strumień decyzji (reuse wzorca `entity-callout-list`).

Integracja z mapą:
- **Overlay „dlaczego tak?"** na Mapie firmy — przy węźle/encji ikona; klik pokazuje powiązane decyzje (z `decisionLinks` gdzie entity = ta encja).
- **Ścieżka wstecz**: klik dowolnej encji (podstrona, kampania) → podświetlony łańcuch upstream do segmentu i problemu + decyzje uzasadniające.

AI akcje: „Zapisz tę zmianę jako decyzję" (z kontekstu edycji), „Znajdź sprzeczne decyzje".

---

## 2. Kampanie i reklamy (Egzekucja) — Faza 4

Encja: `campaigns` + `funnelElementCampaigns`.

UI: trasa `/execution/campaigns`. `DataTable` (shadcn/TanStack): nazwa, cel, segment, etap lejka, kanały, budżet plan/wydany (pasek wykorzystania), okres, status. Edytor kampanii (inline/drawer): pola + `creatives` (lista linków, `JsonListEditor`), `utm` (struktura), `landingPageId` (`OptionCombobox` po `pages`), powiązanie z elementami lejka (`RelationPicker`).

Graf wpływu: kampania to węzeł typu `campaign`, krawędź „promowany przez" (element → campaign). Kolor `#a78bfa`.

---

## 3. GEO / AEO (Egzekucja) — Faza 4

Encje: `geoAssets`, `geoQueries` + `funnelElementGeo`.

UI: trasa `/execution/geo`, dwie zakładki:
- **GEO assets**: checklisty AEO per podstrona (`llms.txt`, schema.org JSON-LD, strony-odpowiedzi, FAQ pod AI). `checklist` jako lista toggle (`ListItemsEditor`). Filtr po `siteId`/`pageId`.
- **GEO queries**: `DataTable` — pytanie do AI, intencja, etap lejka, target page, status cytowania per silnik (ChatGPT/Perplexity/AI Overview) z badge `cited/missing/unknown` (`citationStatus` json). Monitoring agenta (Faza 8).

Graf wpływu: węzeł `geo` (kolor `#22d3ee`), krawędź „cytowalny w AI przez".

---

## 4. Produkty i usługi (Egzekucja) — Faza 4

Encje: `offers` + `offerSegments`.

UI: trasa `/execution/offers`. `DataTable`: nazwa, typ (produkt/usługa/pakiet), pricing, segmenty docelowe (chipy z `offerSegments`), UVP per oferta, status. Edytor inline + `RelationPicker` do segmentów. Relacje do lejka/podstron opcjonalne (przyszłość).

---

## 5. Multi-site / Strony WWW (Egzekucja) — Faza 2

Encja: `sites` + `siteId` na pages/nav/seo/audits.

UI: trasa `/execution/sites`. U góry **przełącznik stron** (`OptionCombobox` po `sites` projektu, primary domyślnie zaznaczony) + „+ dodaj stronę". Reszta (mapa serwisu, podstrony, nawigacja, SEO) filtrowana po wybranym `siteId`. Reuse istniejących edytorów strony ([website-dashboard.tsx](app/(strategy-hub)/strategy-hub/projects/[id]/website/website-dashboard.tsx), `page-section-editor`), dodając filtr `siteId`.

Komponent **Page Section Editor** (spec pkt 6): split 3-kolumnowy — lista sekcji (drag-reorder) | edycja sekcji (Purpose, Schema, Copy=Tiptap, CTA, design notes) | live preview iframe (`/strategy-hub/preview/[project]/[page]`). Reuse istniejących `pageSections` (child entity).

---

## 6. Komentarze per encja — Faza 6

Encja: `entityComments`.

Komponent `components/strategy-hub/entity-comments.tsx` (`use client`): wątek komentarzy dołączany do dowolnej encji (segment, obiekcja, podstrona, KPI, decyzja). Pola: body, mentions (`@kamil`/`@klient`), authorType. Renderowany w drawerze/panelu bocznym encji. Klient komentuje w Dashboardzie (tryb client) — wspólna tabela, komentarz widać w Hubie.

Powiązane:
- **Last-update badges**: chip „Edytowane 2 h temu przez Kamila / AI dodało 5 min temu / Z Notion 1 h temu" — z `changeHistory` (istnieje) + `entityComments`. Filtr „Pokaż co zmienione od ostatniej wizyty klienta" (z `clientVisitsLog`).
- **Version timeline**: drawer z historią zmian encji + diff-view (Git-like) + restore. Backend: `changeHistory` (już jest).

---

## 7. Weekly review + alerty + email digest — Faza 7

- **Weekly review** (Cmd+Shift+R): trasa `/measurement/review`. Co zmieniono w 7 dni (po module, diff), KPI on/below target (red list z `rules.alerts`), to-do tygodnia (`projectTasks` + AI sugestie). Eksport PDF (reuse `@react-pdf/renderer`, jest w deps + istniejący `business/pdf`).
- **Alerty**: serwis czytający `rules.alerts` — KPI < pct po N dniach, domena wygasa < N dni (`domains`), sync failed > N (`notionSyncLog`), pierwsza wizyta klienta (`clientVisitsLog`). Toast + e-mail.
- **Email digest** (Resend, jest): tygodniowy — top 3 zmiany, KPI movement 30 dni, linki do nowych sekcji, CTA „Otwórz Dashboard". Konfigurowalny cadence.

---

## 8. AI Sidekick (drawer Cmd+J) — Faza 8

Komponent `components/strategy-hub/ai-sidekick.tsx` — drawer 400 px z prawej, reuse istniejącego [chat-panel.tsx](components/strategy-hub/chat/chat-panel.tsx) i AI SDK. Trzy zakładki:
- **Sugestie kontekstowe** — zależne od edytowanej encji (segment → „Zaproponuj 5 obiekcji", obiekcja → „Znajdź dowód", podstrona → „Wygeneruj hero z CTA", lejek → „Czego brakuje w MOFU?").
- **Chat z Claude** — pamięta kontekst projektu przez MCP (`hub_get_project`); „wstaw do sekcji X". Reguły AI z istniejących ustawień (`strategy-hub-ai-rules`).
- **Analizy** — `hub_analyze_strategy` (luki/sprzeczności), `hub_compare_competitors`, audyt lejka, „Co zmienić by zwiększyć Health Score?".

Reuse istniejących MCP tooli ([lib/strategy-hub/ai-tools.ts](lib/strategy-hub/ai-tools.ts), [lib/strategy-hub/mcp/](lib/strategy-hub/mcp/)). Dodać toole dla nowych encji (decyzje, kampanie, GEO, oferty).

`sparkle` button per sekcja (Cmd+/): predefiniowane akcje per typ encji wstrzykiwane do Sidekicka z kontekstem.

---

## 9. Onboarding wizard (7 kroków) — Faza 8

Trasa `/strategy-hub/projects/new` (rozbudowa istniejącej [projects/new/page.tsx](app/(strategy-hub)/strategy-hub/projects/new/page.tsx)). Kroki: Podstawy (nazwa/branża/domena/ikona) → Klient (kontakt/dostępy) → Tożsamość (misja/wizja/ToV lub upload brandbooka → AI wyciąga) → Problemy+UVP → Segmenty (AI `hub_suggest_segments`) → Lejek (AI `hub_suggest_funnel`) → Strona (istnieje? upload audytu / AI proponuje mapę serwisu). Wynik: szablon strategii ~40% Health Score, dashboard klienta gotowy.

Empty states: każda pusta sekcja ma „Zacznij od…" z 2–3 przykładami z RetroHouse/Lumine; „Zaimportuj z Notion" (AI parsuje stronę → wypełnia model — migracja istniejących projektów).

---

## 10. Komponenty interaktywne (spec pkt „Interaktywne komponenty kluczowe")

Status reuse vs build:

| Komponent | Stan | Uwaga |
|---|---|---|
| Positioning Quadrant (drag&drop) | istnieje ([positioning-editor.tsx](components/strategy-hub/positioning-editor.tsx)) | dodać eksport PNG/SVG |
| Funnel Flow Builder (React Flow) | istnieje ([funnel-flow.tsx](components/strategy-hub/funnel-flow.tsx)) | reuse |
| Channel Heatmap (pivot) | częściowo (marketing) | dopracować pivot kanał × segment × etap + sumy |
| Segment Cards (tabbed) | istnieje ([segments-editor.tsx](app/(strategy-hub)/strategy-hub/projects/[id]/segments/segments-editor.tsx)) | reuse + zakładka Cennik B2B |
| Objections Drill (split) | istnieje (business) | reuse + AI „Zaproponuj dowód" |
| Page Section Editor (split+preview) | częściowo | dodać live preview iframe + filtr siteId |
| KPI Live Dashboard | istnieje ([kpi-client.tsx](app/(strategy-hub)/strategy-hub/projects/[id]/kpi/kpi-client.tsx) + `sparkline`) | reuse |
| Buyer Journey Table | istnieje (segment child) | dodać „Przekuj na lejek" (AI) |

## 11. Design system (spec)

- Typografia: Geist Sans (display/UI), Inter (body), JetBrains Mono (kod/ID) — `next/font`.
- Kolory: brand navy (Syntance) + accent pomarańcz + status semantyczny + 12-stopniowa szarość, OKLCH (reguła `00-core`). Dark mode od dnia 1 (jest, `theme-provider`).
- Mikrointerakcje: fade-in 150 ms, magnetic hover na markerach quadrantu, pulse zielony na auto-save, confetti przy KPI > 100% — wszystkie respektują `prefers-reduced-motion`.
