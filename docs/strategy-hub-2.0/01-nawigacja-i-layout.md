# 01 — Nawigacja i layout

Cel: spłaszczyć nawigację do **5 obszarów + Mapa firmy (ekran zerowy)**, zachowując układ (lewy sidebar z grupami, nagłówek, workspace, AI Sidekick z prawej) oraz sekcję **Custom Apps**. Maks. 2 kliknięcia od mapy do edytora encji.

## 1. Layout główny (3 kolumny)

Zostaje obecny shell [components/strategy-hub/strategy-hub-shell.tsx](components/strategy-hub/strategy-hub-shell.tsx), rozszerzony o trzecią kolumnę (AI Sidekick, Faza 8):

```
┌──────┬────────────────────────────┬──────┐
│ Side │   Workspace                │  AI  │
│ bar  │   (mapa / edytor / pivot)  │ kick │
│ 240px│                            │ 400px│
└──────┴────────────────────────────┴──────┘
```

- Sidebar 240 px (`collapsible="icon"`) — switcher projektów u góry (jest), 5 obszarów + ekran zerowy z health-score dot per obszar, Custom Apps, System (sync + ustawienia), stopka usera. Zostaje bez zmian strukturalnych.
- Workspace — `<main>` z `children`; każdy obszar ma własny widok.
- AI Sidekick — `Sheet`/drawer wysuwany z prawej (Cmd+J). Dodawany w Fazie 8; w shellu rezerwujemy slot.

## 2. Struktura sidebara (po zmianie)

Plik: [components/strategy-hub/nav-sidebar.tsx](components/strategy-hub/nav-sidebar.tsx). Zachowujemy `Sidebar/SidebarContent/SidebarGroup/SidebarMenu` (linie 164–331). Zmieniamy wyłącznie definicje pozycji.

Grupy:

1. **Nawigacja** (global): `Projekty` → `/strategy-hub` (zostaje).
2. **(per projekt) Projekt** — switcher ścieżki (`PathSelector`, zostaje) + pozycje:
   - `Mapa firmy` → `/strategy-hub/projects/[id]` (ekran zerowy, `exact: true`)
   - `Strategy Canvas` → `/strategy-hub/projects/[id]/canvas` (widok alternatywny)
3. **(per projekt) Obszary** — 5 pozycji z health-score dot:
   - `Fundament` → `/foundation`
   - `Rynek` → `/market`
   - `Egzekucja` → `/execution`
   - `Pomiar` → `/measurement`
   - `Ustawienia projektu` → `/project-settings`
4. **Custom Apps** (BEZ ZMIAN): `Liczenie godzin` → `/strategy-hub/apps/time-tracking`. Reuse obecnej tablicy `customAppItems` (linie 52–59) i renderu (linie 249–278).
5. **System**: `Ustawienia globalne` → `/strategy-hub/settings` (zawiera podstrony, m.in. `…/settings/rules`).

Nowy kształt tablic (zastępuje `viewItems`/`strategyItems`):

```ts
const projectViewItems = (id: string) => [
  { label: "Mapa firmy", href: `/strategy-hub/projects/${id}`, icon: MapIcon, exact: true },
  { label: "Strategy Canvas", href: `/strategy-hub/projects/${id}/canvas`, icon: LayoutDashboard },
];

const areaItems = (id: string) => [
  { key: "foundation",  label: "Fundament",   href: `/strategy-hub/projects/${id}/foundation`,  icon: Gem },
  { key: "market",      label: "Rynek",       href: `/strategy-hub/projects/${id}/market`,      icon: Users },
  { key: "execution",   label: "Egzekucja",   href: `/strategy-hub/projects/${id}/execution`,   icon: Megaphone },
  { key: "measurement", label: "Pomiar",      href: `/strategy-hub/projects/${id}/measurement`, icon: Gauge },
  { key: "settings",    label: "Ustawienia projektu", href: `/strategy-hub/projects/${id}/project-settings`, icon: Settings },
];
```

Health-score dot: `areaItems` mapuje `key` na `ModuleHealth.score` (z `/api/strategy-hub/projects/[id]/health`), kolor kropki: ≥80 zielony, >0 żółty, =0 szary. Dodać `<span>` kropkę w `SidebarMenuButton`. Klient nie widzi blokad/pulsowania (tryb editor only).

## 3. Mapowanie tras (stare → nowe)

Stare strony stają się **zakładkami** wewnątrz obszaru. Każdy obszar to layout z poziomym tab-barem (shadcn `Tabs`) lub pod-route segmentami. Rekomendacja: pod-route segmenty (`/foundation/brand`, `/foundation/decisions`…) + wspólny `layout.tsx` obszaru renderujący tab-bar — pozwala na deep-link i zachowuje SSR.

| Stara trasa | Nowa trasa | Obszar |
|---|---|---|
| `/projects/[id]` (Widok główny) | `/projects/[id]` → render `<StrategyMap mode="editor" />` | Mapa firmy |
| `/projects/[id]/canvas` | `/projects/[id]/canvas` (bez zmian) | — |
| `/projects/[id]/strategy-map` | `/projects/[id]` (scalone z ekranem zerowym) + redirect | Mapa firmy |
| `/projects/[id]/brand` | `/projects/[id]/foundation/brand` | Fundament |
| `/projects/[id]/business` | `/projects/[id]/foundation/business` (problemy, UVP, pozycjonowanie, konkurencja, obiekcje) | Fundament |
| — (nowe) | `/projects/[id]/foundation/decisions` (Rejestr decyzji) | Fundament |
| `/projects/[id]/segments` | `/projects/[id]/market/segments` | Rynek |
| — | `/projects/[id]/market/journey`, `/market/segmentation` (dane rynkowe + kryteria) | Rynek |
| `/projects/[id]/funnel` | `/projects/[id]/execution/funnel` | Egzekucja |
| `/projects/[id]/marketing` | `/projects/[id]/execution/channels` (mapa działań/pivot) | Egzekucja |
| `/projects/[id]/sales` | `/projects/[id]/execution/copy` (pitche, skrypty, lead magnety, wytyczne) | Egzekucja |
| — (nowe) | `/projects/[id]/execution/campaigns` (Kampanie) | Egzekucja |
| `/projects/[id]/website` | `/projects/[id]/execution/sites` (multi-site: przełącznik stron, mapa serwisu, podstrony, nawigacja, SEO) | Egzekucja |
| — (nowe) | `/projects/[id]/execution/geo` (GEO/AEO) | Egzekucja |
| — (nowe) | `/projects/[id]/execution/offers` (Produkty i usługi) | Egzekucja |
| `/projects/[id]/kpi` | `/projects/[id]/measurement/kpi` | Pomiar |
| (audyty w website) | `/projects/[id]/measurement/audits` | Pomiar |
| — (nowe) | `/projects/[id]/measurement/review` (Weekly review), `/measurement/reports` | Pomiar |
| `/projects/[id]/discovery` | `/projects/[id]/project-settings/discovery` | Ustawienia projektu |
| `/projects/[id]/admin` (Infrastruktura) | `/projects/[id]/project-settings/access` (dostępy, hosting, domeny, linki) | Ustawienia projektu |
| `/strategy-hub/sync` | `/projects/[id]/project-settings/sync` (per projekt) + globalny pozostaje | Ustawienia projektu |
| `/projects/[id]/chat` | przeniesione do AI Sidekick (Cmd+J); trasa zachowana jako fallback | — |

### Redirecty (zero broken links)

Dodać `redirect()` w starych `page.tsx` lub wpisy w middleware/`next.config`. Rekomendacja: cienkie `page.tsx` w starych ścieżkach wywołujące `redirect("…nowa trasa…")` (App Router, RSC). Zachować przez ≥1 release.

## 4. Mapa firmy jako ekran zerowy

Po wejściu w projekt (`/projects/[id]`) domyślnie renderuje się `<StrategyMap mode="editor" projectId={id} />` z widokiem domyślnym **Lista** (outline drzewa modułów ze statusami) i przełącznikiem `[Lista | Mapa]` + `▶ Prezentacja` w prawym górnym rogu workspace. To zachowanie już istnieje w komponencie — zmiana dotyczy tego, że mapa jest ekranem startowym projektu (a nie osobną pozycją).

Edycja na mapie (2.0): „+" w kolumnie/porcie węzła → wysuwana karta-edytor reuse `RelationPicker` i pól z panelu encji. Szczegóły mechaniki w `04-moduly-2.0.md`.

## 5. Command Palette (Cmd+K)

Nowy komponent `components/strategy-hub/command-palette.tsx` (`use client`) oparty o `cmdk` (już w deps) + shadcn `Command`. Montowany w shellu, globalny. Akcje:

- Nawigacja: „Pokaż segment X", „Pokaż lejek B2B", „Otwórz Mapę firmy", skok do obszaru.
- Mutacje przez AI: „Dodaj obiekcję 'za drogie' do segmentu A" → propozycja dowodu → enter zapisuje (przez te same endpointy co AI Sidekick).
- Systemowe: „Sync z Notion teraz", „Eksportuj strategię jako PDF", „Otwórz dashboard klienta".

Inspiracja: Linear / Raycast / Notion command bar. Indeks akcji budowany z `areaItems` + listy encji projektu.

## 6. Skróty klawiszowe

Globalny hook `components/strategy-hub/use-hotkeys.ts` (`use client`), respektuje pola input (nie przechwytuje gdy focus w input/textarea/edytor), wyłączany przy `prefers-reduced-motion` tylko dla animowanych przejść (nie dla akcji).

| Skrót | Akcja |
|---|---|
| Cmd+K | Command palette |
| Cmd+J | Toggle AI Sidekick |
| Cmd+P | Przełącz projekt |
| Cmd+, | Ustawienia projektu |
| Cmd+Shift+R | Weekly review |
| Cmd+Shift+C | Toggle „Pokaż jak widzi klient" (side-by-side) |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo (w sesji edycji) |
| Cmd+/ | AI w bieżącej sekcji |
| G S / G L / G W / G C | Idź do: Rynek-Segmenty / Egzekucja-Lejek / Egzekucja-Strony / Mapa firmy (Canvas) |

## 7. Tryby editor vs client

Ten sam komponent renderuje się w dwóch trybach (`mode: "editor" | "client"`):

| | editor | client |
|---|---|---|
| Karta L3 / element | edytowalna inline (RelationPicker) | read-only + komentarze |
| Stany | ✅/🟡/🔴 + blokady + „do przeglądu" | tylko ✅/🟡, czysto |
| Domyślny ekran | Lista (drzewo) | Mapa / Prezentacja |
| Sekcje techniczne | Discovery/Hosting/Audyt/Sync widoczne | ukryte |

Dashboard klienta (`syntance.dev`, read-only) reużywa tych samych komponentów z `mode="client"` (Faza 9). Brak duplikacji designu.

## 8. Side-by-side compare („Pokaż jak widzi klient")

Toggle Cmd+Shift+C dzieli workspace 50/50: edytor (editor) po lewej, dashboard (client) po prawej; zmiany live synchronizowane (wspólny stan/optimistic). Implementacja: `Resizable` (shadcn) + dwa rendery tego samego widoku z różnym `mode`. Faza 9.

## 9. Inline edit (filozofia UX)

Wszędzie: klik wartość → edycja → auto-save z 300 ms debounce + optimistic UI; bez modali „edytuj/zapisz". Cmd+Z/Cmd+Shift+Z = undo/redo w sesji. To wzorzec obowiązujący w nowych modułach (Faza 3+) i przy refaktorze istniejących edytorów (oportunistycznie).

## 10. Responsywność

| Breakpoint | Layout | Co działa |
|---|---|---|
| ≥1280 px | 3 kolumny | wszystko, pełna edycja, komponenty interaktywne |
| ≥1024 px | sidebar collapsible, sidekick toggle | pełna edycja |
| ≥768 px | sidebar w drawerze, single-column | read + edycja prostych pól |
| mobile | stack vertical | read-only + KPI update + notatki + zadania; pełna edycja zablokowana z infem „Use desktop" |
