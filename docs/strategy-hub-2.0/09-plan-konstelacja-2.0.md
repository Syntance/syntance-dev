# SPEC: Konstelacja 2.0 — pełnoekranowy mózg z drill-down + domknięcie pokrycia grafu

> Dokument wykonawczy dla agenta implementującego (Cursor Composer). Kontynuacja `08-plan-mozg-graf.md` — tamte zasady globalne (npm, TS strict, Zod, polskie etykiety, paleta bez zmian, bramki po fazach) obowiązują nadal.
> Kolejność faz: **K0 → K1 → K2 → K3 → K4 → K5**. Nie przechodź dalej przy czerwonej bramce.

## Kontekst — stan po wdrożeniu 08 (zweryfikowany)

- Konstelacja działa jako tryb w switcherze `strategy-map.tsx` (list/map/influence/constellation/pipeline). Ma: radial layout (d3-hierarchy), kamerę (use-camera), panel encji, onMapFocus z czatu, deep-link `?focus=`, mode=client.
- Read-model: `lib/strategy-hub/constellation-data.ts` + `constellation-types.ts` (core → 7 obszarów → encje, cross-linki z `entity_relations`, statusy z rules).
- Katalog typów: `lib/strategy-hub/entities/entity-types.ts` — 15 typów. **Luka pokrycia**: obszar „przekaz" ma TYLKO `offer`; w grafie brakuje encji rejestru: `sales-pitches`, `sales-scripts`, `lead-magnets`, sekcje stron, `geo-queries`, `sites`.
- Lint: **16 błędów `react-hooks/set-state-in-effect`** w nowych komponentach (agent-panel, auto-relations-panel, constellation-view, pipeline i in.) — fetch z `setState` w efekcie.
- Nav: `components/strategy-hub/nav-sidebar.tsx` — pozycje „Mapa firmy" (`/strategy-hub/projects/${projectId}`) i „Canvas" (`.../canvas`).

## Cel produktowy (wizja użytkownika — referencja: alassafi.ai)

Konstelacja = **osobny widok w menu, pełnoekranowy** (cały viewport poza sidebarem). Trzy poziomy nawigacji:

1. **Poziom „Organizm"**: w centrum rdzeń = biznes (projekt); wokół niego podgrupy-konstelacje = obszary strategii (fundament, segmenty, lejek, kanały, przekaz, strona, KPI). Każda podgrupa to klaster: węzeł obszaru + jego encje jako małe punkty-gałązki (jak na referencji).
2. **Poziom „Obszar"** (klik podgrupy, np. Lejek): wybrana podgrupa w centrum ekranu ze WSZYSTKIMI swoimi encjami; **po lewej** kolumna węzłów, które WPŁYWAJĄ na ten obszar (upstream), **po prawej** — co z niego WYNIKA (downstream).
3. **Poziom „Element"** (klik encji, np. konkretny user flow): encja w centrum; po lewej encje z krawędziami wchodzącymi (np. lejek, segment), po prawej — wychodzącymi (np. podstrony, sekcje strony).

Przykład kanoniczny: Lejek → user flow: lewo = elementy lejka/segment, prawo = sekcje na stronie/podstrony.

---

# FAZA K0 — Lint do zera (16 błędów react-hooks) (S)

Wszystkie błędy to `react-hooks/set-state-in-effect`: wzorzec `useEffect(() => { void load(); }, [load])` gdzie `load` synchronicznie woła `setState` (np. `setLoading(true)`) na starcie. **Napraw wg wzorca już istniejącego w repo** — znajdź komponenty/hooki, które fetchują i przechodzą lint (np. starsze panele Hub, `use-project-alerts.ts`) i powiel ich wzorzec. Typowe poprawne rozwiązania: inicjalizuj `loading: true` w `useState` (bez setState na starcie efektu), `setState` wyłącznie w kontynuacjach async (`.then`), lub przejdź na wzorzec subskrypcji. NIE wyciszaj reguły przez `eslint-disable`.

**Bramka K0**: `npm run lint` → 0 błędów, 0 warningów; `npm run typecheck` zielony.

# FAZA K1 — Domknięcie pokrycia grafu (M)

## K1.1. Nowe typy w katalogu `entity-types.ts`

Dodaj do `EntityTypeKey` + `ENTITY_TYPE_META` (kolory dobierz z istniejącej palety semantycznej aplikacji — sprawdź kolory tych modułów w UI; area jak niżej):

| typ | registryKey | area | uwaga |
|---|---|---|---|
| `sales_pitch` | `sales-pitches` | przekaz | |
| `sales_script` | `sales-scripts` | przekaz | |
| `lead_magnet` | `lead-magnets` | przekaz | |
| `section` | (sprawdź klucz w registry/extended-registry — sekcje stron; jeśli sekcje są per-page w osobnej tabeli, dodaj typ z odpowiednim selectem) | strona | wymagane przez przykład „user flow → sekcje" |
| `geo_query` | `geo-queries` | kanaly | |
| `site` | `sites` | strona | |

- `entityTypeFor` w `track-change.ts`: usuń z `REGISTRY_FALLBACK` klucze, które przechodzą do katalogu.
- `buildEmbeddingText` (`embeddings/content.ts`): dodaj mapy pól tekstowych dla nowych typów.
- **Jawna lista wykluczeń** (komentarz w entity-types.ts): `questions, glossary, credentials, materials, notes, tasks, channel-activity-plan, site-maintenance-costs, site-audits, nav-items` — encje operacyjne, NIE wchodzą do grafu strategii.
- Singletony (UVP, positioning, brand identity) nie są węzłami — ich treść pokazuje panel rdzenia (K4).

## K1.2. Read-model i graf

- `constellation-data.ts`: dołącz selecty nowych typów (wzorzec istniejących; soft-delete + visibility jak reszta).
- `relation-graph.ts` (widok Canvas): dołącz nowe typy analogicznie (żeby oba grafy pokrywały ten sam zbiór).

**Bramka K1**: typecheck/lint/build zielone; `npm run test` zielony; ręcznie: konstelacja pokazuje pitche/skrypty/lead magnety w obszarze „przekaz".

# FAZA K2 — Kierunkowość i model upstream/downstream (M)

## K2.1. Kanoniczny kierunek „przyczyna → skutek"

W `entity-types.ts` dodaj stałą `AREA_DEPENDENCIES: Record<StrategyArea, StrategyArea[]>` — skąd czerpie obszar (zgodnie z maszyną stanów reguł, `rules/defaults.ts`): np. `segmenty: ["fundament"]`, `lejek: ["segmenty"]`, `kanaly: ["lejek"]`, `przekaz: ["fundament", "segmenty"]`, `strona: ["lejek", "przekaz"]`, `kpi: ["lejek", "kanaly", "strona"]` — **zweryfikuj dokładne zależności z `rules/defaults.ts` (upstream locks) i użyj ich, nie zgaduj**.

Zweryfikuj kierunek krawędzi derywowanych z FK w `constellation-data.ts`/`relation-graph.ts`: konwencja source=przyczyna, target=skutek (segment→stage→element→flow→page→section; problem→segment; campaign→page). Tam gdzie jest odwrotnie — odwróć przy derywacji (bez zmian w DB).

## K2.2. Read-model scen (nowe API)

Rozszerz `constellation-types.ts` + `constellation-data.ts` + endpoint o parametr sceny:

```ts
export type ConstellationScene =
  | { level: "organism" }
  | { level: "area"; area: StrategyArea }
  | { level: "entity"; ref: { type: EntityTypeKey; id: string } };

export interface SceneData {
  scene: ConstellationScene;
  center: ConstellationNode;            // core | area | encja
  members: ConstellationNode[];         // encje sceny (organism: wszystkie per obszar; area: encje obszaru; entity: [])
  upstream: ConstellationNode[];        // co wpływa (area: węzły obszarów z AREA_DEPENDENCIES + encje z krawędziami DO członków; entity: źródła krawędzi wchodzących)
  downstream: ConstellationNode[];      // co wynika (analogicznie w drugą stronę)
  links: ConstellationLink[];           // krawędzie widoczne w scenie (member↔member, upstream→center/members, members→downstream)
  breadcrumb: { label: string; scene: ConstellationScene }[];
}
```

GET `/api/strategy-hub/projects/[id]/constellation?level=organism|area|entity&area=...&entityType=...&entityId=...` (Zod na query; stary kształt odpowiedzi może zostać usunięty, jeśli nic innego go nie konsumuje — sprawdź). Upstream/downstream liczone z: (a) krawędzi `entity_relations` + FK-derived (kierunek z K2.1), (b) na poziomie obszaru dodatkowo `AREA_DEPENDENCIES`. Limity: upstream/downstream ≤ 15 węzłów (sortuj po liczbie krawędzi), reszta jako `childCount`.

**Bramka K2**: nowy test w `scripts/test-constellation-layout.ts` lub osobny `test-constellation-scenes.ts` (dopisz do `test`): fixture w DB (projekt testowy: segment→stage→element→flow + flow→page przez relację) → scena `entity` dla flow ma element/segment w `upstream`, page w `downstream`; scena `area` dla lejka ma fundament/segmenty w upstream (z AREA_DEPENDENCIES), stronę w downstream.

# FAZA K3 — Osobny pełnoekranowy widok w menu (M)

- **Nowa strona** `app/(strategy-hub)/strategy-hub/projects/[id]/constellation/page.tsx`: RSC ładujący scenę `organism` + dynamic import `ConstellationView` (ssr:false). Layout pełnoekranowy: wysokość `100dvh` minus header Hub, bez paddingu contentu, sidebar zostaje (sprawdź jak `canvas/page.tsx` robi szeroki layout i zrób analogicznie lub szerzej).
- **Nav**: w `nav-sidebar.tsx` dodaj pozycję „Konstelacja" (ikona np. `Sparkles`/`Orbit` z lucide) między „Mapa firmy" a „Canvas".
- **Wypnij konstelację ze switchera** `strategy-map.tsx` (tryby zostają: list/map/influence/pipeline); przycisk „Konstelacja" w switcherze zamień na link do nowej strony. Zaktualizuj deep-linki: `?view=constellation&focus=...` → przekierowanie/link na `/constellation?focus=...` (fallbackowy link w `tool-call-card.tsx` też).
- **Portal klienta**: nowa strona `app/projects/[slug]/strategy/constellation/page.tsx` full-screen mode=client; link z istniejącej nawigacji portalu.
- E2E `e2e/constellation.spec.ts`: zaktualizuj nawigację (wejście przez pozycję menu zamiast zakładki).

**Bramka K3**: typecheck/lint/build; e2e constellation przechodzi; `npm run analyze` — nowa strona < 200 KB initial JS.

# FAZA K4 — UI poziomów: organizm → obszar → element (L)

- **Poziom organizm**: layout jak dziś (radial d3-hierarchy), ale wizualnie klastrowany jak referencja: encje jako małe punkty na „gałązkach" obszaru (LOD: bez etykiet encji, etykiety obszarów zawsze, obszary z pierścieniem statusu). Klik/Enter na obszarze → przejście do sceny area (fetch nowej sceny + animacja kamery: zoom w klaster, crossfade do nowego layoutu; `useReducedMotion` → bez animacji).
- **Poziom obszar**: centrum = węzeł obszaru + jego encje w radialu wokół; **lewa kolumna** upstream (nagłówek „Wpływa na: [obszar]"), **prawa kolumna** downstream („Wynika z tego"). Węzły kolumn mniejsze, z krawędziami do centrum/członków. Klik węzła upstream/downstream → przejście do jego sceny (area lub entity). Klik encji-członka → scena entity.
- **Poziom element**: encja w centrum (duży węzeł + meta), lewo/prawo jak wyżej. Panel encji (istniejący `entity-panel.tsx`) otwiera się z prawej na żądanie (Enter/klik „Szczegóły"), nie automatycznie.
- **Breadcrumb** u góry: „Biznes → Lejek → User flow X" (klik = powrót do sceny). **Esc** = poziom wyżej. **←/→** = poprzedni/następny obszar (poziom area) lub encja w obszarze (poziom entity). Stan sceny w URL (`?level=&area=&type=&id=` przez searchParams) — odświeżenie strony wraca do tej samej sceny; `?focus=type:id` → od razu scena entity.
- `focus_map_node` z czatu (onMapFocus): `focus` → scena entity danego węzła; `path` → scena entity źródła + podświetlenie kolejnych krawędzi.
- A11y jak dotąd: roving tabindex w obrębie sceny, `aria-live` ogłasza zmianę sceny („Obszar Lejek, 12 elementów, 4 wpływające, 6 wynikających").

**Bramka K4**: E2E: klik obszaru „Lejek" → widoczne kolumny lewo/prawo (`data-testid="scene-upstream"` / `"scene-downstream"`); klik encji → scena entity z breadcrumbem 3-poziomowym; Esc wraca; deep-link `?level=area&area=lejek` działa; reduced-motion bez animacji. Testy jednostkowe layoutu scen (pozycje kolumn nie nachodzą na radial centrum).

# FAZA K5 — Sprzątanie i spójność (S)

- Panel rdzenia (scena organism, klik w core): health score + treść singletonów (UVP, pozycjonowanie) w panelu bocznym.
- Sprawdź, że `semantic_search`/`get_neighbors` w czacie zwracają też nowe typy (K1) — jeśli toolsety filtrują po typach, zaktualizuj.
- ADR `docs/adr/0010-konstelacja-sceny-drilldown.md`: decyzje — sceny zamiast jednego grafu, kierunek przyczyna→skutek, AREA_DEPENDENCIES z rules, wykluczenia encji operacyjnych.
- Pełna bramka końcowa: `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e`.

---

# Zbiorczo

**Nowe pliki**: strona `[id]/constellation/page.tsx`, portal `[slug]/strategy/constellation/page.tsx`, `test-constellation-scenes.ts`, ADR 0010.
**Modyfikowane**: entity-types.ts (nowe typy + AREA_DEPENDENCIES + wykluczenia), constellation-data/types (sceny, upstream/downstream), constellation-view + use-camera + area-navigator (poziomy, breadcrumb, URL state), nav-sidebar, strategy-map.tsx (wypięcie konstelacji), tool-call-card (link), relation-graph.ts (nowe typy), content.ts (embeddingi nowych typów), track-change.ts (fallback map), e2e.
**Bez zmian**: schema DB (zero migracji — wszystko na istniejących tabelach), store relacji, undo, agent, pipeline.
