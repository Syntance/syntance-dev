# SPEC WDROŻENIOWA: Widoki strategii — Nitka, Blueprint segmentu, Warstwa decyzji

> Dokument wykonawczy dla agenta implementującego (Cursor Composer). Wykonuj fazy ŚCIŚLE po kolei: **A → B → C**. Po każdej fazie uruchom bramkę jakości. Nie przechodź dalej przy czerwonej bramce.
> Kontekst produktowy: `10-design-konstelacja.md` (design system konstelacji — obowiązuje 1:1 również tutaj) oraz `09-plan-konstelacja-2.0.md` (sceny). Te trzy widoki odpowiadają na trzy pytania: **Nitka** = „jak X wpływa na Y end-to-end", **Blueprint** = „czy maszyna segmentu jest kompletna", **Warstwa decyzji** = „z czego to wynika".

## Zasady globalne (obowiązują w każdej fazie)

- Menedżer pakietów: **npm** (NIE pnpm, wbrew globalnemu CLAUDE.md). Komendy: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`.
- **`next build` NIE uruchamia ESLint** — lint odpalaj OSOBNO i doprowadź do zera błędów.
- ESLint react-hooks v6: **zakaz `setState` w `useEffect` bez zabezpieczenia**. Wzorce dozwolone w repo: (a) derived state przez porównanie z poprzednią wartością w renderze (`const [prev, setPrev] = useState(x); if (x !== prev) { setPrev(x); ... }` — patrz `constellation-view.tsx` linie ~215), (b) `useMotionValueEvent` dla wartości Motion, (c) stan ustawiany w callbackach zdarzeń.
- TypeScript strict: zero `any`, zero `as` jako ucieczki. Zod na każdym wejściu API. Każdy fetch: `AbortSignal.timeout(...)`.
- Route'y API: wzorzec walidacji + auth z istniejących (`requireProjectAccess` / `requireStrategyHubAccess`, patrz `app/api/strategy-hub/projects/[id]/constellation/route.ts`).
- Komponenty grafowe: `"use client"`, ładowane przez `next/dynamic(..., { ssr: false })` (wzorzec: `constellation-page-loader.tsx`).
- Etykiety UI i komentarze po polsku. `prefers-reduced-motion`: KAŻDA animacja z tej spec ma fallback natychmiastowy (`useReducedMotion()` z `motion/react` albo media query w CSS).
- Nie zmieniaj palety aplikacji. Kolory WYŁĄCZNIE z `KONST` (`components/strategy-hub/constellation/constellation-theme.ts`) i `ENTITY_TYPE_META`/`AREA_META`.
- Drizzle: brak `onConflict` na częściowych indeksach unikalnych — select-then-insert. Fire-and-forget w route handlers: `after()` z `next/server` w try/catch.

## Kontekst — co już istnieje (ZWERYFIKOWANE, nie sprawdzaj ponownie)

| Obszar | Fakty |
|---|---|
| Design system | `constellation-theme.ts`: obiekt `KONST` (tło `#16130E`, kość słoniowa `#EFE7CE`, chrome `#211D15`/`#3A342A`, chłodny upstream `#9FB2DC`, ciepły downstream `#E3BE85`, muted `#8E8672`, label `#CFC7AC`, display `#E9E1C6`, review `#FACC15`) + `seededRandom`, `generateStars`. Font display: **Fraunces** przez `next/font/google` PER ROUTE (wzorzec: `app/(strategy-hub)/strategy-hub/projects/[id]/constellation/page.tsx` — const `fraunces` z `variable: "--font-konst"`, klasa na wrapperze). W komponentach: `fontFamily: "var(--font-konst, Georgia, 'Times New Roman', serif)"`. |
| Graf relacji | `lib/strategy-hub/relations/store.ts` (server-only): `listRelations`, `createRelation`, `updateRelation`, `softDeleteRelation`, `restoreRelation`, `getNeighbors(projectId, ref, depth)`, **`findPath(projectId, a, b, maxDepth=4)`**, `getSubgraph`, `listProjectRelationsByType`. Tabela `entity_relations` ma `relationType`, `strength`, `rationaleMd`, `source('human'|'ai')`, `confidence`. |
| Typy encji | `lib/strategy-hub/entities/entity-types.ts` (client-safe): `ENTITY_TYPE_META` (label, color, area, href), `RELATION_TYPES` (etykiety PL), `AREA_META`. Typ `stage` istnieje w katalogu. |
| Etapy per segment | **`purchaseStages` NALEŻĄ DO SEGMENTU**: `db/schema.ts` l.342: `purchase_stages(segmentId → segments, name, phase, orderIdx, trigger, objections, emotionalState, questions, deletedAt)`. `funnelElements.stageId → purchase_stages`. Kolumny blueprintu = purchaseStages wybranego segmentu wg `orderIdx` (DYNAMICZNE, nie hardcodowane 4). |
| Decyzje | `strategicDecisions` (l.1696: title, reasonMd, evidenceMd, status, authorType, reviewFlag) + `decisionLinks` (decisionId, entityType, entityId, **role: "cause" \| "effect"** — enum w `app/api/.../decisions/[decisionId]/links/route.ts` l.14). Istnieje endpoint `decision-trail` i komponent `decision-overlay` (strategy-map). |
| Konstelacja | `components/strategy-hub/constellation/`: `constellation-view.tsx` (sceny organism/area/entity, kamera spring 260/28, `useMotionValueEvent` stabilizacja przy scale≥1.25, panel encji po prawej, breadcrumb-pill, wielka etykieta Fraunces na dole ze strzałkami ‹ ›), `entity-panel.tsx` (props: `onShowScene?`), `scene-layout.ts`, `use-camera.ts`, `area-glyphs.tsx`. Read-model: `lib/strategy-hub/constellation-data.ts` + `constellation-scenes.ts`, typy w `constellation-types.ts`. Focus z czatu: `lib/strategy-hub/map-focus-bus.ts` (`onMapFocus`, mode `focus|highlight|path`). |
| Nawigacja | Editor: `components/strategy-hub/nav-sidebar.tsx` → `projectViewItems` (l.74: Mapa firmy / Konstelacja / Strategy Canvas). Portal klienta: `components/dashboard/client-nav.tsx` (l.48 ma Konstelację). Widoczność encji dla klienta: `lib/strategy-hub/visibility.ts`. |
| E2E | `e2e/constellation.spec.ts` — wzorzec logowania i helper `openFirstProjectConstellation`. Playwright: `page.emulateMedia({ reducedMotion: "reduce" })`. |
| Testy | `npm run test` = łańcuch skryptów `tsx scripts/test-*.ts` w package.json (dopisuj nowe na koniec łańcucha). |

## Decyzje projektowe (FINALNE — nie zmieniaj)

1. **Trzy widoki, JEDEN nowy punkt nawigacji.** Blueprint = nowa strona w menu. Nitka = tryb na stronie konstelacji (query param, bez wpisu w menu). Warstwa decyzji = overlay w blueprincie + w konstelacji (bez wpisu w menu).
2. **Selektor segmentu wszędzie tam, gdzie treść dotyczy konkretnego segmentu**: blueprint (zawsze), nitka (gdy ścieżka przechodzi przez segment — pozwala przepiąć nitkę na inny segment), warstwa decyzji w blueprincie (dziedziczy wybrany segment jako filtr). Jeden współdzielony komponent.
3. Stan wyboru w URL (`?segment=`, `?thread=`, `?decisions=1`) — odświeżenie strony odtwarza widok; deep-linki działają z czatu AI.
4. Estetyka = 1:1 design system konstelacji („nocne niebo strategii"): tło `KONST.bg`, punkty kość słoniowa, chłodny/ciepły dla przyczyna/skutek, Fraunces dla nagłówków display, sans huba dla mikro-etykiet, watermark, chrome-pille.
5. Portal klienta: blueprint i nitka dostępne read-only (mode="client", filtr `visibility.ts`, zero przycisków edycji). Warstwa decyzji: TYLKO editor (decyzje wewnętrzne — nie pokazujemy klientowi).

---

## Wspólne fundamenty (wykonaj PRZED fazą A)

### W1. Selektor segmentu — `components/strategy-hub/segment-selector.tsx`

`"use client"`. Props:

```ts
interface SegmentSelectorProps {
  segments: { id: string; name: string; icon?: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}
```

**Wygląd (chrome-pill konstelacji):** kapsuła wys. 32px, bg `KONST.chromeBg`, border 0.5px `KONST.chromeBorder`, radius pełny. Zawartość: label „Segment:" (11px, `KONST.muted`, tracking 0.08em) + nazwa segmentu (12px, `KONST.label`, font-medium) + chevron 14px (`KONST.muted`). Hover: nazwa → `KONST.display`. Focus-visible: ring 2px `#EFE7CE`/60.
**Dropdown:** własny listbox (NIE natywny `<select>` — wygląd), pozycjonowany pod pillem, bg `#1C1913`, border `KONST.chromeBorder`, radius 12px, shadow-2xl, max-h 280px overflow-y-auto. Pozycja: 12px `KONST.label`, aktywna: bg `#2A251B` + kropka 4px `#EFE7CE` po lewej. Pełna klawiatura: Enter/Space otwiera, ↑/↓ nawigacja, Enter wybiera, Escape zamyka; `role="listbox"`/`option`, `aria-expanded`, `aria-activedescendant`.
**Animacja:** dropdown `opacity 0→1` + `translateY -4→0`, 140ms `easeOut`; reduced-motion: natychmiast. Zmiana segmentu NIE animuje pilla.

### W2. Standard animacji (referencja dla wszystkich faz)

| Token | Wartość | Użycie |
|---|---|---|
| `SPRING_CAMERA` | `{ stiffness: 260, damping: 28 }` | ruch kamery (istniejący w use-camera — reuse) |
| `SPRING_POP` | `{ stiffness: 300, damping: 22 }` | pojawianie węzłów (scale 0.6→1) |
| `DRAW_EDGE` | `pathLength 0→1`, 500ms, `easeOut` | rysowanie krawędzi nitki |
| `STAGGER_THREAD` | 120ms między segmentami nitki | sekwencja lewo→prawo |
| `STAGGER_COLUMN` | 60ms między kolumnami blueprintu | wejście widoku |
| `FADE_DIM` | `opacity → 0.18`, 200ms, `easeOut` | przygaszanie nie-zasięgu decyzji |
| `HALO_IN` | `opacity 0→1`, 300ms, `easeOut` | halo na zasięgu decyzji |
| `PANEL_SLIDE` | `x 24→0` + `opacity`, 200ms, `easeOut` | szuflady/panele |

Animowane wyłącznie `transform`/`opacity`/`pathLength`. `useReducedMotion()` → wszystkie natychmiastowe (duration 0), zero staggerów, zero draw-in.

---

# FAZA A — NITKA (tryb konstelacji, rozmiar M)

Poziomy łańcuch przyczynowy end-to-end dla jednej encji: `Segment → Problem → Etap → Treść/Element → Flow → Strona/Sekcja → KPI`, z decyzjami przypiętymi do krawędzi.

## A1. Read-model — `lib/strategy-hub/thread-data.ts` (server-only)

```ts
export interface ThreadNode {
  ref: { type: EntityTypeKey; id: string };
  label: string;
  color: string;        // ENTITY_TYPE_META[type].color
  typeLabel: string;    // ENTITY_TYPE_META[type].label
  isFocus: boolean;     // encja startowa (większy węzeł)
  href?: string;
}
export interface ThreadEdge {
  from: number; to: number;          // indeksy w nodes
  relationLabel: string;             // z RELATION_TYPES lub etykieta FK ("należy do", "w etapie")
  decisions: ThreadDecision[];       // decyzje przypięte do tej krawędzi
}
export interface ThreadDecision {
  id: string; title: string; reasonMd: string | null; createdAt: string;
}
export interface ThreadData {
  nodes: ThreadNode[];
  edges: ThreadEdge[];
  segmentId: string | null;          // segment na ścieżce (dla selektora)
  segments: { id: string; name: string }[]; // wszystkie segmenty projektu (selektor)
}
export async function getThread(projectId: string, ref: EntityRef, mode: "editor"|"client"): Promise<ThreadData>
```

**Algorytm budowy (deterministyczny — implementuj DOKŁADNIE tak):**
1. Zdefiniuj **kanoniczną oś typów** (kolejność nitki): `segment → problem → stage → element → flow → page → section → kpi`. Pozostałe typy (channel, campaign, offer, geo, competitor, objection, seo_keyword) NIE wchodzą na oś — są „odgałęzieniami" (patrz pkt 4).
2. Od encji startowej `ref` buduj oś w OBU kierunkach po krawędziach grafu (`getNeighbors` depth 1, iteracyjnie) ORAZ po FK strukturalnych (element→stage przez `funnelElements.stageId`, stage→segment przez `purchaseStages.segmentId`, kpi→segment przez `kpis.segmentId` — selecty bezpośrednie). W każdym kroku wybierz sąsiada, którego typ jest NAJBLIŻEJ na osi kanonicznej w danym kierunku; przy remisie: najwyższy `strength`, potem najnowszy. Max 8 węzłów osi. Cykle: odwiedzone id w `Set`.
3. Krawędź osi dostaje `relationLabel` z `RELATION_TYPES[relationType].label`; dla kroków FK użyj etykiet: stage→segment `"segmentu"`, element→stage `"w etapie"`, kpi→segment `"segmentu"`.
4. **Decyzje na krawędziach:** dla każdej pary sąsiadujących węzłów osi (A,B) pobierz decyzje, których `decisionLinks` zawierają OBA (dowolne role) LUB zawierają B z role `effect` i A z role `cause`. Jeden select wszystkich decisionLinks projektu + join w pamięci. Max 2 decyzje/krawędź (najnowsze).
5. `mode:"client"`: przefiltruj węzły przez `visibility.ts`; jeżeli węzeł osi odpada — zepnij sąsiadów krawędzią z etykietą `"…"`. Decyzje w mode client: ZAWSZE puste tablice.

**Endpoint:** `GET app/api/strategy-hub/projects/[id]/constellation/thread/route.ts?type=&id=&mode=` — Zod (type przez `ENTITY_TYPE_META`, id uuid), auth jak w constellation route.

## A2. Komponent — `components/strategy-hub/constellation/thread-view.tsx`

`"use client"`. Renderowany przez `constellation-view.tsx` ZAMIAST sceny, gdy w URL jest `?thread=type:id` (parsuj w `constellation-page-loader`/stronie tak jak `focus`; wyjście z nitki = usunięcie parametru → powrót do poprzedniej sceny).

**Układ (desktop):**
- Tło: to samo co konstelacja (kontener konstelacji zostaje — thread-view to `<g>` w tym samym SVG albo osobny SVG w tym samym kontenerze; wybierz osobny `<svg>` w kontenerze — prostsze, kamera nie jest potrzebna, układ jest statyczny i responsywny).
- Oś pozioma: węzły rozmieszczone równomiernie na szerokości (padding poziomy 64px), oś na wysokości 42% kontenera. Przy >6 węzłach: zmniejsz odstępy, etykiety węzłów skracaj do 18 znaków z „…".
- **Węzeł osi:** okrąg r11 (focus: r14 + zewnętrzny ring r+6 opacity 0.3), fill `#1C1B18`, ring 1.4px w kolorze TYPU encji (`node.color`), środek: kropka 3px `#EFE7CE`. Pod węzłem: typeLabel (11px, `KONST.muted`) i niżej label (11px, `KONST.label` dla focus / `#B7AE97` dla reszty), oba wycentrowane, tracking 0.08em.
- **Krawędź osi:** łuk quadratic delikatnie NAD osią (control point y-24), kropkowana `2 4`, 1px, kolor `KONST.down` opacity 0.45, marker-strzałka 6px (reuse patternu markerów z constellation-view — `konst-arrow-down`). Etykieta relacji NA łuku (11px italic, `#C6A876`, wycentrowana nad szczytem łuku).
- **Decyzje:** pod krawędzią, do której należą: pionowa nitka `1 4` dash od krawędzi w dół (kolor `KONST.spark` opacity 0.35) do **rombu 18×18** (rect rotate 45°, bg `#211D15`, ring 1.1px `KONST.spark`, litera „D" 10px `KONST.spark`). Obok rombu: tytuł decyzji (11px `KONST.downText`) + data (11px `KONST.muted`) + skrót reasonMd (2 linie max, 11px `KONST.muted`). Przy 2 decyzjach na krawędzi — układaj pionowo (odstęp 56px). Klik rombu → istniejący `decision-overlay`.
- **Chrome:** breadcrumb-pill u góry (jak w konstelacji): `Nitka · {label focusa}`; obok **SegmentSelector** (W1), widoczny gdy `segments.length > 1` — wybór przepina nitkę: nawiguj na `?thread=segment:{id}` (nitka od segmentu). Przycisk zamknięcia ✕ (ghost, prawy górny róg) → usuwa `thread` z URL. Na dole wielka etykieta Fraunces: „NITKA" (24px, tracking 0.35em) + podtytuł `{focus label} · {n} ogniw · {m} decyzji` (11px `KONST.muted`, tracking 0.18em).
- **Interakcje:** klik węzła osi → nawigacja do sceny elementu konstelacji (`?level=entity&type=&id=`); hover węzła → ring jaśnieje + etykieta → `KONST.display`; Escape → zamknij nitkę. Roving tabindex po węzłach (←/→), Enter = wejście.

**Animacja wejścia (sekwencja, `STAGGER_THREAD`):** węzeł 0 pop (`SPRING_POP`), potem krawędź 0→1 `DRAW_EDGE`, potem węzeł 1 pop… lewo→prawo; etykiety relacji fade-in 200ms po narysowaniu swojej krawędzi; romby decyzji na końcu, wszystkie razem, fade+translateY(-6→0) 250ms. Całość ≤ 2.2s dla 8 węzłów. Reduced-motion: wszystko widoczne od razu.

## A3. Wejścia do nitki

1. `entity-panel.tsx`: nowy przycisk **„Pokaż nitkę"** (obok „Graf zależności", ten sam styl) → dodaje `thread=type:id` do URL (zachowaj pozostałe parametry sceny).
2. Czat AI: w `lib/strategy-hub/ai-tools-graph.ts` narzędzie `focus_map_node` — dodaj do enum `mode` wartość `"thread"`; w `map-focus-bus` i subskrypcji w `constellation-view` obsłuż `mode:"thread"` → ustaw `?thread=`. Dopisz w system promptcie czatu (sekcja nawigacji): „Gdy użytkownik pyta o wpływ/pochodzenie elementu end-to-end, użyj focus_map_node z mode:'thread'".
3. (Przygotowanie pod fazę C) Eksportuj z thread-view typ propsów tak, by dało się otworzyć nitkę z dziennika decyzji.

## Bramka A

1. `npm run typecheck && npm run lint && npm run build` — zielone.
2. **Nowy `scripts/test-thread.ts`** (dopisz do `test`): na projekcie testowym (wzorzec setup/teardown z `scripts/test-relations.ts`) zbuduj segment+stage+element+kpi+relacje → `getThread` od elementu zwraca oś w kolejności kanonicznej (segment przed stage przed element), max 8 węzłów, krawędzie mają etykiety; decyzja z linkami cause/effect na parze (stage,element) pojawia się na właściwej krawędzi; mode:"client" nie zwraca decyzji.
3. E2E (dopisz do `e2e/constellation.spec.ts`): panel encji → klik „Pokaż nitkę" → URL ma `thread=`, widok renderuje ≥3 węzły osi i wielką etykietę „NITKA"; Escape wraca do sceny; reduced-motion: brak animacji (elementy widoczne natychmiast po załadowaniu).

---

# FAZA B — BLUEPRINT SEGMENTU (nowa strona, rozmiar L)

Macierz „maszyny segmentu": kolumny = etapy zakupu wybranego segmentu (`purchaseStages` wg `orderIdx`), wiersze = warstwy TREŚCI / KANAŁY / STRONA / KPI. Puste komórki = luki strategii.

## B1. Read-model — `lib/strategy-hub/blueprint-data.ts` (server-only)

```ts
export interface BlueprintCellItem {
  ref: { type: EntityTypeKey; id: string };
  label: string;
  color: string;
  status?: NodeStatus;          // reviewFlag → "review"
  viaLabel?: string;            // etykieta relacji, którą trafił do komórki
}
export type BlueprintRow = "tresci" | "kanaly" | "strona" | "kpi";
export interface BlueprintStageColumn {
  stage: { id: string; name: string; phase: string | null; orderIdx: number;
           trigger: string | null; questions: string | null };
  cells: Record<BlueprintRow, BlueprintCellItem[]>;
  gaps: BlueprintRow[];         // wiersze z pustą komórką
}
export interface BlueprintData {
  segments: { id: string; name: string; icon: string | null; priority: number }[];
  selected: { id: string; name: string; personaName: string | null;
              problemSummary: string | null } | null;  // problemSummary: pierwsze zdanie problemMd segmentu (obetnij do 140 znaków)
  columns: BlueprintStageColumn[];
  gapCount: number;
}
export async function getBlueprint(projectId: string, segmentId: string | null, mode: "editor"|"client"): Promise<BlueprintData>
```

**Wypełnianie komórek (dla każdego etapu):**
- `tresci`: `funnelElements` z `stageId = stage.id` (bez deletedAt), sort priority/updatedAt, **max 6** + jeżeli więcej: ostatni item syntetyczny `{ label: "+N więcej", ref: pierwszy pominięty }`.
- `kanaly`: z relacji `entity_relations` — dla elementów tej komórki `tresci`: relacje `publikowany_w` → channel i `promowany_przez` → campaign. Deduplikuj po ref. `viaLabel` = etykieta relacji.
- `strona`: relacje `prowadzi_przez` (flow→page) i `laduje_na` z elementów etapu oraz flowy powiązane z elementami etapu (relacje element↔flow dowolnego typu). Kolejność: flow, page, section.
- `kpi`: relacje `mierzony_przez` z elementów etapu → kpi; PLUS kpi z FK `kpis.segmentId = segment.id` przypisane do etapu, jeżeli mają relację do elementu etapu; kpi segmentowe bez etapu → NIE wchodzą do kolumn (patrz wiersz zbiorczy niżej — NIE, uproszczenie: pomiń; kpi bez etapu widać w konstelacji).
- `gaps`: wiersze z pustą listą. Wyjątek: NIE oznaczaj luki `kanaly`/`strona` dla etapów `phase` zawierającego "retencj" (case-insensitive) — retencja często nie ma kanału akwizycji.
- `segmentId == null` → wybierz segment o najwyższym `priority` (a przy braku segmentów zwróć `selected: null`, `columns: []`).
- `mode:"client"`: filtr `visibility.ts` na itemach komórek.
- Wydajność: JEDEN select relacji projektu (`listRelations`) + mapy w pamięci; żadnych N+1.

**Endpoint:** `GET app/api/strategy-hub/projects/[id]/blueprint/route.ts?segment=&mode=`.

## B2. Strona + komponenty

- **Editor:** `app/(strategy-hub)/strategy-hub/projects/[id]/blueprint/page.tsx` — RSC jak strona konstelacji (Fraunces per-route z `variable: "--font-konst"`, wrapper `-m-6 h-[calc(100dvh-3rem)]`, initial data z `getBlueprint`). **Nav:** dopisz do `projectViewItems` w `nav-sidebar.tsx` pozycję `{ label: "Blueprint segmentu", href: .../blueprint, icon: Grid3x3 }` (lucide `Grid3x3`) POD Konstelacją.
- **Portal klienta:** `app/projects/[slug]/strategy/blueprint/page.tsx` (wzorzec: portalowa strona konstelacji; mode="client") + wpis w `client-nav.tsx` pod Konstelacją.
- **Komponenty:** `components/strategy-hub/blueprint/blueprint-view.tsx` (+ `blueprint-cell.tsx`), ładowane dynamic ssr:false przez `blueprint-page-loader.tsx` (wzorzec constellation-page-loader).

**Układ `blueprint-view` (desktop ≥1024px):**
- Kontener: bg `KONST.bg`, winieta jak konstelacja (`KONST.bgVignette`), starfield NIE (spokojniejszy widok roboczy), klasa `dark`.
- **Nagłówek (wys. 96px, sticky top):** po lewej SegmentSelector (W1); obok linia kontekstu segmentu: `persona · problem` (11px, `KONST.muted`, tracking 0.08em, max 1 linia ellipsis). Po prawej: licznik luk — pill `⚠ {gapCount} luk` (bg `#211D15`, tekst `#FACC15` 11px) — klik przewija do pierwszej luki; obok (faza C doda przycisk „Decyzje").
- **Grid:** poziomy scroll przy >4 kolumnach (`overflow-x-auto`, scroll-snap kolumn). Kolumna: min 220px, max 280px, flex-1. Lewa kolumna etykiet wierszy: 96px, sticky left.
- **Nagłówek kolumny:** nazwa etapu (13px, `KONST.label`, uppercase, tracking 0.22em, wycentrowana) + pod nią `phase` (11px, `KONST.muted`); linia separatora pionowa między kolumnami `#E7DFC6` opacity 0.1. Tooltip (title/popover) na nagłówku: trigger + questions etapu.
- **Etykiety wierszy** (lewa, pionowo rozłożone): TREŚCI / KANAŁY / STRONA / KPI — 11px, tracking 0.2em, kolory: `#34D399` / `#C9955C` / `#94A3B8` / `#F472B6`, opacity 0.85.
- **Komórka:** pionowa lista itemów; item = kropka r4.5 `#EFE7CE` (status review: ring `#FACC15` 1px) + label 11px `#B7AE97` (hover: `#CFC7AC`), `viaLabel` po najechaniu jako suffix ` · publikowany w` (11px italic `KONST.muted`). Odstęp itemów 26px. W kolumnie itemy `tresci` połączone pionową nicią 1px `#E7DFC6` opacity 0.22 (kręgosłup etapu — nawiązanie do sceny obszaru).
- **Luka:** w miejscu pustej komórki ramka dashed `3 4`, 1px `#FACC15` opacity 0.6, radius 6px, wys. 30px, tekst wycentrowany `luka: brak {nazwa wiersza}` (11px `#FACC15` opacity 0.8). Editor: klik luki → link do edytora właściwego modułu (`ENTITY_TYPE_META[...].href` obszaru wiersza: tresci→lejek, kanaly→kanaly, strona→strona, kpi→kpi). Client: luka bez linku.
- **Stopka:** wielka etykieta Fraunces „PRZEKRÓJ SEGMENTU" (clamp 20–28px, tracking 0.35em, `KONST.display`) + podtytuł `{n} etapów · {m} elementów · {gapCount} luk` — jak w konstelacji, wycentrowana, 24px od dołu.
- **Interakcje:** klik itemu → nawigacja do konstelacji `?level=entity&type=&id=` (pełny graf zależności); hover itemu → podświetl WSZYSTKIE itemy tej kolumny połączone relacją z hoverowanym (opacity reszty komórek kolumny → 0.4, 150ms); Alt+klik / menu kontekstowe NIE — prostota. Klawiatura: tab po itemach, Enter = wejście.
- **Mobile (<1024px):** kolumny full-width, scroll-snap-x mandatory, wskaźnik kropek pod nagłówkiem (aktualna kolumna), wiersze bez zmian.

**Animacje:** wejście widoku: kolumny fade + translateY 12→0, `STAGGER_COLUMN` 60ms, 300ms easeOut; zmiana segmentu w selektorze: stary grid fade-out 150ms → nowy wjeżdża tym samym staggerem; luki: pojedynczy puls ringu (opacity 0.6→1→0.6, 900ms, 1 iteracja) 400ms po wejściu; hover-podświetlenie kolumny: 150ms. Reduced-motion: zero staggerów i pulsów.

**Stan URL:** `?segment=<uuid>` (bez parametru = domyślny wg priority). Zmiana w selektorze: `router.replace` z nowym parametrem (bez scrolla do góry).

## Bramka B

1. typecheck/lint/build zielone.
2. **Nowy `scripts/test-blueprint.ts`** (dopisz do `test`): projekt testowy z 2 segmentami × (2 etapy, elementy, relacje publikowany_w/mierzony_przez) → `getBlueprint`: kolumny w kolejności orderIdx; kanał trafia do komórki `kanaly` właściwego etapu; pusta komórka daje `gaps`; wyjątek retencji działa; segmentId=null wybiera segment o najwyższym priority; mode client filtruje niewidoczne.
3. E2E `e2e/blueprint.spec.ts`: login → blueprint → renderują się nagłówki etapów wybranego segmentu; selektor zmienia `?segment=` i nagłówki; luka widoczna z tekstem „luka:"; klik itemu nawiguje do konstelacji na scenę encji; portal klienta: strona działa, zero elementów edycyjnych.
4. Ręcznie: 60fps przy scrollu poziomym (DevTools performance) — grid bez animacji layoutu.

---

# FAZA C — WARSTWA DECYZJI (overlay, rozmiar M)

Dziennik decyzji + „zasięg wpływu" podświetlany na blueprincie i w konstelacji. TYLKO mode="editor".

## C1. Read-model — `lib/strategy-hub/decisions-ledger.ts` (server-only)

```ts
export interface LedgerDecision {
  id: string; title: string; reasonMd: string | null; evidenceMd: string | null;
  status: string; authorType: string; createdAt: string;
  causes: { type: EntityTypeKey; id: string; label: string }[];   // role="cause" — „z czego wynika"
  effects: { type: EntityTypeKey; id: string; label: string }[];  // role="effect" — „na co wpływa"
  segmentIds: string[];  // segmenty w zasięgu (bezpośrednio linkowane LUB przodkowie effectów po FK stage→segment)
}
export async function getDecisionsLedger(projectId: string): Promise<LedgerDecision[]>
```

Etykiety encji: pobierz zbiorczo per typ (mapy id→label; wzorzec z `constellation-data.ts`). Sort: createdAt desc. **Endpoint:** `GET .../decisions-ledger/route.ts` (editor only — w mode client zwróć 403).

## C2. UI — `components/strategy-hub/decisions/decision-ledger.tsx`

Wspólna szuflada używana w DWÓCH miejscach:
1. **Blueprint:** przycisk w nagłówku `Decyzje ({n})` (pill chrome jak licznik luk, tekst `KONST.label`) → szuflada z LEWEJ strony (nietypowo — prawa jest zajęta przez panel encji w konstelacji; w blueprincie też lewa dla spójności), szer. 320px, bg `rgba(28,25,19,0.96)` + backdrop-blur 8px, border-r 0.5px `KONST.chromeBorder`, `PANEL_SLIDE` (z lewej: x -24→0). Filtr: pokazuj decyzje, których `segmentIds` zawiera wybrany segment LUB są globalne (puste segmentIds); przełącznik „wszystkie/segment" (2 taby tekstowe 11px).
2. **Konstelacja:** parametr `?decisions=1` + przycisk „Decyzje" w chrome (obok breadcrumba, ta sama stylistyka pill) → ta sama szuflada.

**Karta decyzji (w szufladzie):** radius 10px, bg `#1C1913`, border 0.5px `#3A342A`, padding 12px, odstęp 8px. Zawartość: `#{krótki-nr} · {title}` (12px, `#B7AE97`, medium), data + authorType (11px `KONST.muted`), reasonMd skrócony do 2 linii (11px `KONST.muted`). **Karta aktywna** (kliknięta): border `KONST.spark` opacity 0.7, bg `#211D15`, u dołu linia `zasięg: {causes.length + effects.length} elementów →` (10–11px `KONST.spark`).

**Zasięg wpływu (klik karty):**
- **W konstelacji:** nowy stan `dimToDecision: LedgerDecision | null` w `constellation-view`; gdy ustawiony — wszystkie węzły i krawędzie POZA `causes+effects` dostają `FADE_DIM` (opacity 0.18), a węzły zasięgu: halo (okrąg r+5, `KONST.spark` opacity 0.55, `HALO_IN`) — **causes z ringiem chłodnym `KONST.up`, effects z ciepłym `KONST.down`** (spójna semantyka przyczyna/skutek). Kamera: `focusNode` na centroid zasięgu (średnia pozycji), scale dopasowany żeby zasięg mieścił się w 70% viewportu. Drugi klik karty / Escape / zamknięcie szuflady → zdejmij.
- **W blueprincie:** itemy komórek spoza zasięgu → opacity 0.25 (`FADE_DIM`), itemy zasięgu → label `KONST.display` + kropka z ringiem `KONST.spark`; kolumny bez żadnego trafienia przygasają całe.
- Z karty: link „Pokaż nitkę" gdy decyzja ma ≥1 effect typu z osi kanonicznej → otwiera `?thread=` dla pierwszego effectu (w konstelacji; z blueprintu — nawigacja do konstelacji z parametrem).

## C3. Proces zapisu — decyzje przy relacjach

Minimalny krok domykający pętlę „każda ważna krawędź ma uzasadnienie":
- `entity-panel.tsx` → formularz „Dodaj relację": pod selectami dodaj opcjonalne pole tekstowe **„Dlaczego? (uzasadnienie)"** (input 12px, placeholder „np. COO nie czyta PDF-ów — webinar konwertuje lepiej"); wartość → `rationaleMd` w POST /relations (schema już to przyjmuje).
- W `ai-tools-write.ts` (narzędzie `create_relation`) `rationaleMd` już jest wymagane — bez zmian.
- Nitka (A1 pkt 4): gdy krawędź nie ma decyzji, ale relacja ma `rationaleMd` — pokaż zamiast rombu mniejszy znacznik kółko 10px `KONST.spark` opacity 0.6 z rationaleMd jako tekstem (te same style co decyzja, bez tytułu). Dopisz to do thread-data (`edge.rationaleMd?: string`).

## Bramka C

1. typecheck/lint/build + pełne `npm run test`.
2. Rozszerz `scripts/test-thread.ts`: krawędź z `rationaleMd` bez decyzji zwraca `edge.rationaleMd`; `getDecisionsLedger` zwraca causes/effects z etykietami i `segmentIds` wyprowadzone przez FK stage→segment.
3. E2E: konstelacja `?decisions=1` → szuflada widoczna; klik karty → węzły spoza zasięgu mają opacity < 0.3 (sprawdź atrybutem/stylem), Escape zdejmuje; blueprint → przycisk „Decyzje" otwiera szufladę, filtr segmentu działa.
4. Portal klienta: `decisions-ledger` zwraca 403; w UI klienta przycisk nie istnieje.

---

# Zbiorczo

**Nowe pliki:** `segment-selector.tsx`, `thread-data.ts` + route, `thread-view.tsx`, `blueprint-data.ts` + route, strony blueprint (editor+portal) + loader + `blueprint-view.tsx`/`blueprint-cell.tsx`, `decisions-ledger.ts` + route, `decision-ledger.tsx`, `scripts/test-thread.ts`, `scripts/test-blueprint.ts`, `e2e/blueprint.spec.ts`.
**Modyfikowane:** `constellation-view.tsx` (tryb thread, dim decyzji, przycisk Decyzje), `entity-panel.tsx` („Pokaż nitkę", pole uzasadnienia relacji), `ai-tools-graph.ts` + system prompt czatu (mode "thread"), `map-focus-bus.ts`, `nav-sidebar.tsx`, `client-nav.tsx`, package.json (testy).
**Zero nowych zależności. Zero migracji DB** (wszystko na istniejących tabelach).
**ADR:** `docs/adr/0011-widoki-strategii-nitka-blueprint-decyzje.md` — decyzje: 3 pytania → 3 widoki, jeden punkt nawigacji, decyzje na krawędziach (rationaleMd relacji jako decyzja „lekka"), oś kanoniczna nitki, luki liczone z relacji (nie z heurystyk).

**Weryfikacja końcowa:** `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e`. Scenariusz demo: blueprint segmentu → widać 2 luki → klik elementu → graf zależności → „Pokaż nitkę" → pełny łańcuch z decyzją na krawędzi → czat: „pokaż wpływ segmentu MŚP na zapisy" → nitka otwiera się sama.
