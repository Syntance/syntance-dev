# 12 — Kompletna logika aplikacji: strategia wg podejścia Negacza (SellWise)

> Dokument projektowy DO ANALIZY (nie spec wykonawcza). Definiuje docelową logikę całej aplikacji:
> jak w Strategy Hub powstaje strategia firmy, marketingu i sprzedaży, jak klocki wpływają na siebie
> i jakie edytory/widoki obsługują każdy element. Na końcu: plan faz + otwarte pytania do decyzji.
> Kontekst: 02-model-danych, 08-plan-mozg-graf (graf relacji), 11-plan-widoki-strategii (Nitka/Blueprint/Decyzje).

---

## 0. Zasada naczelna (jedno zdanie)

**Kręgosłupem każdej strategii jest podróż zakupowa segmentu (`purchaseStages`); każdy inny klocek
— treść, kanał, kampania, pitch, podstrona, KPI — istnieje wyłącznie jako ODPOWIEDŹ na konkretny
etap tej podróży, a spójność strategii = pokrycie wszystkich etapów odpowiedziami połączonymi
relacjami w grafie.**

To jest wprost metodyka Negacza: rynek w większości nie jest gotowy do zakupu → firma musi
edukować i prowadzić klienta przez JEGO proces zakupowy (nie przez nasz proces sprzedażowy),
a marketing i sprzedaż są dwiema połówkami tej samej maszyny zbudowanej na tej samej osi etapów.
TOFU/MOFU/BOFU **przestaje być strukturą** — zostaje co najwyżej opcjonalną etykietą etapu do
widoków zbiorczych (heatmapa kanałów między segmentami).

---

## 1. Diagnoza repo — co zostaje, co zmieniamy, czego brakuje

### 1.1 ZOSTAJE (fundament jest dobry — nie ruszać)

| Obszar | Stan | Dlaczego zostaje |
|---|---|---|
| `purchaseStages(segmentId, name, phase, orderIdx, trigger, objections, emotionalState, questions)` | db/schema.ts l.342 | To JEST model podróży zakupowej per segment wg Negacza. Etapy należą do segmentu — dokładnie to, czego chcemy. |
| `funnelElements.stageId → purchaseStages` | db/schema.ts l.382 | Element lejka już wisi na etapie zakupu, nie na fazie. Model danych jest poprawny — złe jest tylko UI. |
| Karta segmentu (JTBD, problem, UVP per segment, triggery, blokery, mentalność, budżet, scoring fit/value/effort, priority) | `segments` | Pełne ICP wg Negacza. |
| Uniwersalny graf `entity_relations` (relationType, strength, rationaleMd, source, confidence) + `RELATION_TYPES` | lib/strategy-hub/relations/store.ts | „Klocki wpływają na siebie" — mechanizm już istnieje i jest dobry. |
| `strategicDecisions` + `decisionLinks(role: cause\|effect)` | schema l.1696+ | Warstwa „dlaczego tak" — decyzje na krawędziach. |
| Widoki: Konstelacja, Nitka (`?thread=`), **Blueprint segmentu** (kolumny = purchaseStages!), Warstwa decyzji | plan 09/10/11 wdrożony | Blueprint już robi to, co user chce od lejka — kolumny dynamiczne z etapów segmentu. To wzorzec do uogólnienia. |
| Silnik reguł (`strategyRuleSets`, resolveModuleStatuses, locki `blockedBy`, health score), `review_flag` + propagacja, `change_history` + undo per batch, embeddingi, AI tools/MCP, SSE | różne | Cała maszyneria spójności i AI — do rozszerzenia, nie wymiany. |
| `AREA_DEPENDENCIES` (fundament→segmenty→lejek→kanały/przekaz/strona→kpi) | entity-types.ts l.272 | Poprawny kierunek przyczynowości. Dojdzie obszar „sprzedaż". |
| Positioning quadrant, obiekcje, konkurenci, oferty+offerSegments, kampanie, GEO/AEO, multi-site, KPI z eventKey | moduły | Kompletne klocki egzekucyjne. |

### 1.2 DO ZMIANY (łamie zasadę naczelną)

| # | Problem | Gdzie | Zmiana |
|---|---|---|---|
| Z1 | **Podwójna taksonomia podróży zakupowej**: `purchaseStages` (lejek) vs `buyerJourneyStages` (market/journey: whatDoesMd, timeHint, ourActionMd). Dwie tabele opisują to samo → strategia niespójna z konstrukcji (journey mówi co innego niż lejek). | schema l.342 i l.883, `BuyerJourneyEditor` | **Scalić w `purchaseStages`** (dodać kolumny `clientDoesMd`, `ourActionMd`, `timeHint`). Jeden edytor (Journey Designer, §4.1). Migracja danych, `buyerJourneyStages` deprecated → drop w fazie sprzątającej. Przycisk „Przekuj na lejek" znika — journey JEST szkieletem lejka. |
| Z2 | **Funnel Board = 4 hardcodowane kolumny TOFU/MOFU/BOFU/Retencja**; drag mapuje pozycję X→faza→szuka etapu po fazie (gubi etapy bez fazy, skleja wiele etapów o tej samej fazie, wymusza tworzenie etapów „pod fazę"). | components/strategy-hub/funnel-board.tsx (PHASES l.23, phaseAt l.74, onNodeDragStop l.240) | **Funnel Board 2.0** (§4.2): kolumny = `purchaseStages` wybranego segmentu wg `orderIdx` (dokładnie jak Blueprint). Drag = bezpośrednia zmiana `stageId`. `phase` tylko jako kolorowy tag na nagłówku kolumny. |
| Z3 | **Dopasowanie po fazie w auto-relacjach**: `normalizePhase`/`PHASE_VALUES` — sugestie element↔kampania/kanał liczone po zgodności TOFU-fazy, nie etapu. | lib/strategy-hub/auto-relations.ts l.45–55 | Dopasowanie po `stageId` (pełna pewność) z fallbackiem na fazę tylko dla rekordów legacy bez stageId. |
| Z4 | **`campaigns.stage`, `channelActivityPlan.stage`, `geoQueries.stage` = varchar TOFU…** — plan aktywności kanału i kampanie nie potrafią wskazać konkretnego etapu segmentu. | schema (campaigns l.~90 w 02-model, channelActivityPlan l.945) | Expand→migrate→contract: dodać nullable `stageId → purchaseStages`; UI pisze stageId; stare varchar zostaje do fazy sprzątającej. Heatmapa kanałów: pivot per etap (w obrębie segmentu) lub per faza (agregat między segmentami — tu faza-tag jest OK). |
| Z5 | **Pitche/skrypty/lead magnety mają `context` varchar i segmentId, ale nie wiedzą, na którym etapie służą** — przekaz sprzedażowy oderwany od podróży. | salesPitches/salesScripts/leadMagnets (schema l.963+) | Bez migracji: relacje w `entity_relations` typu `uzywany_w_etapie` (pitch/skrypt/magnet → stage). Stage już jest typem encji w grafie. |
| Z6 | Moduł `sales` = tylko guidelines (zasady ✓/✗, szablony, hashtagi) — **brak procesu sprzedaży**. | app/.../sales/sales-client.tsx | Nowa warstwa sprzedaży (§3, warstwa 4 + §4.3). Guidelines zostają jako pod-zakładka. |
| Z7 | `PHASE_LABELS`, `STAGES` const w route obiekcji, filtry faz w UI — rozsiane resztki TOFU jako struktury. | strategy-map-types.ts l.167, api/objections | Przejść na etapy/fazę-tag przy okazji każdej fazy wdrożenia (lista w §6). |

### 1.3 BRAKUJE (nowe klocki wg Negacza)

| # | Czego brakuje | Rozwiązanie |
|---|---|---|
| B1 | **Proces sprzedaży zmapowany na podróż zakupową** (lustro: co MY robimy, gdy klient jest na etapie X; kryterium wyjścia z etapu). | Tabela `salesActivities` + pola `ownerSide`/`exitCriterion` na etapie (§2, §4.3). |
| B2 | **Granica marketing→sprzedaż (MQL/SQL, SMarketing)** — wspólna definicja leada osadzona na osi etapów. | Derywowana z `purchaseStages.ownerSide`: pierwszy etap `sales` = handoff. Wizualna, przesuwalna granica w edytorach (§4.3). |
| B3 | **Specjalizacja / pozycjonowanie jako jawny klocek fundamentu** („jesteśmy X dla Y, którzy chcą Z, w przeciwieństwie do W") + niszowanie. | Pola na singletonie business (positioning statement, nisza, dla-kogo-NIE) — bez nowej tabeli; walidowane przez gap engine fundamentu. |
| B4 | **Macierz przekazu** segment × etap (kluczowa wiadomość + dowód odpowiadające na `questions` etapu) — z niej wynika copy stron, treści i pitche. | Widok-macierz na istniejących danych (§4.4) — komunikat per komórka trzymany jako `funnelElements.contentMd`/pitch powiązany relacją; bez nowej tabeli w v1. |
| B5 | **Domknięcie łańcucha etapów**: element ma `cta`, ale nie wiadomo, DOKĄD prowadzi (do następnego etapu? do konkretnej podstrony?). | Relacja `prowadzi_do_etapu` (element → stage) lub istniejące `laduje_na` (element → page). Gap engine: każdy etap poza ostatnim ma ≥1 element z wyjściem do przodu. |

---

## 2. Docelowy model logiczny — 7 warstw strategii

Każda warstwa odpowiada na jedno pytanie strategiczne. Warstwy niższe zasilają wyższe (kierunek
przyczynowości = istniejące `AREA_DEPENDENCIES` + nowy obszar `sprzedaz`). Użytkownik może budować
w dowolnej kolejności — ale graf wie, co z czego wynika, i pokazuje luki.

```
W0 FUNDAMENT (strategia firmy)      → kim jesteśmy, dla kogo, dlaczego my
   misja/wizja · specjalizacja+nisza (B3) · pozycjonowanie (quadrant) · problemy/ambicje biznesowe
   konkurenci · UVP · oferty+pricing · decyzje strategiczne
W1 RYNEK                            → komu sprzedajemy
   segmenty (karta ICP, scoring, priorytet) · problemy/obiekcje per segment
W2 PODRÓŻ ZAKUPOWA  ★KRĘGOSŁUP★     → jak ten segment kupuje
   purchaseStages per segment: trigger · co robi klient · pytania · emocje · obiekcje
   · nasza akcja · kryterium wyjścia · ownerSide (marketing|sales|shared) · faza-tag (opcjonalna)
W3 MASZYNA MARKETINGOWA             → czym odpowiadamy na każdy etap (edukacja rynku)
   funnelElements (treści per etap) · channels+channelActivityPlan (gdzie) · campaigns (wzmocnienie)
   · leadMagnets · GEO/AEO · SEO
W4 MASZYNA SPRZEDAŻOWA              → co robi handlowiec na każdym etapie
   salesActivities per etap · pitche/skrypty per etap (Z5) · obsługa obiekcji per etap
   · granica MQL/SQL (B2) · guidelines (istniejące)
W5 EGZEKUCJA WWW                    → gdzie klient to spotyka
   sites/pages/sections · page↔stage intent (targetuje/laduje_na) · user flows
W6 POMIAR                           → skąd wiemy, że działa
   KPI per etap (konwersja etap→etap = zdrowie podróży) · KPI per segment · north-star
   · weekly review · alerty
```

**Marketing i sprzedaż (W3, W4) to dwie równoległe ścieżki na TEJ SAMEJ osi etapów W2** — to jest
sedno SMarketingu Negacza i sedno spójności aplikacji. Strategia „całej firmy" = W0–W2 + decyzje;
strategia marketingu = W3+W5 czytane przez W2; strategia sprzedaży = W4 czytana przez W2.

### 2.1 Graf spójności (jak klocki na siebie wpływają)

1. **FK strukturalne** (twarde): element→stage→segment, kpi→segment, activityPlan→channel(+stage po Z4),
   campaign→segment(+stage po Z4), offer→segments, page→site. Kręgosłup nie do zerwania.
2. **Relacje semantyczne** (`entity_relations`, miękkie, z `rationaleMd`): `publikowany_w`,
   `promowany_przez`, `mierzony_przez`, `laduje_na`, `adresuje` (treść→obiekcja/problem),
   `oslabia` (dowód→obiekcja), `targetuje`, `wspiera` + NOWE: `uzywany_w_etapie` (pitch/skrypt/
   magnet/salesActivity→stage), `prowadzi_do_etapu` (element→stage następny).
3. **Decyzje** (`decisionLinks` cause/effect) — uzasadnienia na krawędziach (istnieje).
4. **Propagacja zmian**: edycja upstream → `review_flag` downstream po FK + relacjach (istnieje,
   rozszerzyć pokrycie o W2→W4 i business/UVP/konkurentów — dług z audytu).
5. **Gap engine** (§5) — brak odpowiedzi na etap = luka, nie błąd. Luki widoczne wszędzie tam,
   gdzie się pracuje (kolumny edytorów, Blueprint, health score), nie w osobnym raporcie.

---

## 3. Jak powstaje strategia w aplikacji (przepływ pracy)

Domyślna ścieżka (onboarding/pipeline) — ale KAŻDY krok wolno pominąć i wrócić później;
silnik reguł per projekt decyduje, co jest wymagane do statusu „ready" (elastyczność: §7):

1. **Fundament**: misja, specjalizacja, pozycjonowanie, problemy biznesowe, konkurenci, UVP, oferty.
2. **Segmenty**: karty ICP + scoring → priorytety (na czym się skupiamy = niszowanie).
3. **Podróż zakupowa per segment** (Journey Designer §4.1): etapy z triggerami, pytaniami,
   emocjami, obiekcjami, kryteriami wyjścia, ownerSide. ⇒ **od tego momentu wszystkie kolejne
   edytory automatycznie mają kolumny/oś = te etapy.**
4. **Marketing**: Funnel Board 2.0 (§4.2) — do każdego etapu: treści odpowiadające na pytania
   etapu, kanały, kampanie, lead magnety. AI podpowiada luki i auto-relacje (po stageId, Z3).
5. **Sprzedaż**: Sales Process Designer (§4.3) — akcje handlowe per etap, pitche/skrypty,
   obsługa obiekcji etapu, granica MQL/SQL.
6. **Strona**: mapa serwisu + intencje podstron per etap; sekcje z macierzy przekazu (§4.4).
7. **Pomiar**: KPI per etap (konwersje między etapami) + per segment; weekly review.

W tle stale: graf relacji, decyzje na krawędziach, review-flagi, health score, konstelacja/Nitka/
Blueprint jako widoki kontrolne.

---

## 4. Edytory i widoki (UI/UX)

Zasada wspólna: **jedna oś etapów wybranego segmentu we wszystkich edytorach wykonawczych**
(SegmentSelector już istnieje — reuse z 11). Te same kolumny w Journey/Funnel/Sales/Blueprint =
użytkownik uczy się układu raz. Design: edytory robocze w jasnym chrome huba (jak dziś);
widoki kontrolne (konstelacja/nitka/blueprint) w dark KONST — bez zmian.

### 4.1 Journey Designer (NOWY — zastępuje BuyerJourneyEditor + listę etapów w lejku)

Trasa: `market/journey` (istniejąca). Serce aplikacji.

- **Pozioma oś czasu** kart etapów (drag-reorder = `orderIdx`, „+" między kartami wstawia etap).
- **Karta etapu** (rozwijana inline): nazwa · trigger · „co robi klient" (`clientDoesMd`) ·
  pytania (`questions` — lista) · stan emocjonalny · obiekcje etapu · „nasza akcja" (`ourActionMd`)
  · kryterium wyjścia (`exitCriterion`) · ownerSide (segmentowany przełącznik M / M+S / S) ·
  faza-tag (opcjonalny select TOFU/MOFU/BOFU/retencja — tylko etykieta, z tooltipem „do widoków
  zbiorczych").
- **Pierścień kompletności** na każdej karcie (gap engine §5): ile z wymaganych odpowiedzi
  (treść/kanał/akcja sprzedażowa/KPI/wyjście) etap już ma — klik = przejście do właściwego edytora
  z prefiltrem na ten etap.
- **Granica MQL/SQL**: pionowa przerywana linia między pierwszym etapem `sales` a poprzednim,
  z uchwytem (drag przesuwa ownerSide etapów) i etykietą „handoff marketing → sprzedaż".
- Pod osią: **mini-blueprint strip** (zagęszczony podgląd wierszy TREŚCI/KANAŁY/SPRZEDAŻ/KPI —
  read-only, klik → Blueprint).
- AI: „Zaproponuj podróż zakupową dla tego segmentu" (na podstawie karty ICP), „Wygeneruj pytania
  etapu", „Sprawdź spójność triggerów z problemami segmentu".

### 4.2 Funnel Board 2.0 (PRZEBUDOWA funnel-board.tsx — React Flow zostaje)

Trasa: `execution/funnel`. Odpowiedź marketingu na każdy etap.

- **Kolumny = purchaseStages segmentu** wg `orderIdx` (render jak dziś kolumny-fazy, tylko
  dynamiczne; nagłówek: nazwa etapu + faza-tag kolorem + ikonka ownerSide; tooltip: trigger +
  pytania etapu — wzorzec z Blueprintu). Poziomy scroll przy >5 etapach, scroll-snap.
- **Klocki = funnelElements** w kolumnach; drag między kolumnami = `upsertFunnelElement` z NOWYM
  `stageId` wprost z kolumny docelowej (znika lookup po fazie i warning „brak etapu fazy").
- **Prawa szyna: kanały** (jak dziś) — drag-connect element→kanał = `publikowany_w`.
- **Lewa szyna: kampanie + lead magnety** — drag-connect = `promowany_przez` / `uzywany_w_etapie`.
- **Krawędzie z etykietą relacji** (jak w Nitce); klik krawędzi = edycja/rationale/usunięcie.
- **Ghost-cell luki**: pusta kolumna dostaje przerywaną ramkę „brak odpowiedzi na ten etap —
  dodaj treść" (klik = nowy element w etapie). Wyjątki lukowe z silnika reguł (retencja itd.).
- **„+ Dodaj klocek"** w stopce każdej kolumny: typ (artykuł/wideo/webinar/case study/porównanie/
  landing… — format już istnieje), nazwa, CTA + **„dokąd prowadzi"** (następny etap / podstrona —
  tworzy `prowadzi_do_etapu`/`laduje_na`).
- Panel boczny elementu (klik): contentMd (Tiptap), relacje (RelationPicker), komentarze, decyzje.
- Widok „wszystkie segmenty": przełącznik agregatu — wtedy (i tylko wtedy) kolumny = fazy-tagi,
  bo etapy różnych segmentów nie są porównywalne 1:1. Domyślnie zawsze per segment.

### 4.3 Sales Process Designer (NOWY)

Trasa: `sales` (rozbudowa istniejącej strony; guidelines → zakładka „Zasady i szablony").

- **Te same kolumny etapów** co Funnel Board (współdzielony komponent osi kolumn!).
- **Swimlane akcji handlowych**: karty `salesActivities` per etap (typ: research/cold call/
  discovery/demo/oferta/follow-up/negocjacje/onboarding; notatki; narzędzia; drag między etapami).
- **Chipy pitchy/skryptów/magnetów** przypięte do etapu (relacja `uzywany_w_etapie`,
  RelationPicker + drag z listy bocznej).
- **Wiersz obiekcji etapu** (z `purchaseStages.objections` + encje objection powiązane
  `adresuje`): obiekcja → przypięta odpowiedź (pitch/dowód/case) = relacja `oslabia`. Obiekcja
  bez odpowiedzi = luka.
- **Granica MQL/SQL** — ta sama wizualizacja co w Journey Designer (jedno źródło: ownerSide).
- Etapy `marketing`-owned są w tym widoku przygaszone (ale widoczne — handlowiec widzi, co
  marketing robi wcześniej: wspólny obraz = SMarketing).

### 4.4 Macierz przekazu (NOWY widok, bez nowych tabel)

Trasa: `execution/copy` (rozbudowa). Pivot **segment × etap**: w komórce kluczowa wiadomość
(element/pitch z relacją do etapu) + dowód (case/liczba powiązana `oslabia`/`wspiera`).
Odpowiada na pytanie „czy mamy CO powiedzieć każdemu segmentowi na każdym etapie".
Pusta komórka = luka przekazu. Klik = edycja treści. To jest źródło copy dla sekcji stron (W5).

### 4.5 Blueprint segmentu (ROZSZERZENIE — plan 11 wdrożony)

Dodać wiersz **SPRZEDAŻ** (salesActivities + pitche/skrypty per etap) między KANAŁY a STRONA.
Gap engine wiersza: etapy `ownerSide=sales|shared` bez akcji = luka. Blueprint staje się pełnym
audytem maszyny segmentu: TREŚCI / KANAŁY / SPRZEDAŻ / STRONA / KPI.

### 4.6 Bez zmian (już zgodne z logiką)

Konstelacja + panel encji, Nitka (oś kanoniczna zyskuje typy `sales_activity` po B1), Warstwa
decyzji, Mapa firmy, karty segmentów, positioning quadrant, KPI dashboard, kampanie, GEO, sites.
Portal klienta: nowe widoki read-only przez `visibility.ts` (jak blueprint w planie 11).

---

## 5. Silnik spójności (gap engine + propagacja)

Definicja „etap ma odpowiedź" (konfigurowalna w `strategyRuleSets` per projekt — sekcja
`journeyCoverage`):

| Wymóg per etap | Źródło prawdy | Wyjątki (default) |
|---|---|---|
| ≥1 treść (funnelElement) | FK stageId | — |
| ≥1 kanał dystrybucji | relacja `publikowany_w` z elementów etapu LUB activityPlan.stageId | etapy `phase=retencja` |
| ≥1 akcja sprzedażowa | salesActivities.stageId | etapy `ownerSide=marketing` |
| ≥1 wyjście do przodu | `prowadzi_do_etapu`/`laduje_na` z elementów etapu | ostatni etap |
| ≥1 KPI mierzący etap | relacja `mierzony_przez` | konfigurowalne |
| pytania etapu zaadresowane | AI-check: embeddingi treści etapu vs `questions` (miękki sygnał, nie twarda luka) | — |

Poziomy sygnału: **luka** (twarda, licznik w Blueprint/Journey/health), **ostrzeżenie AI**
(sprzeczności: kampania celuje w etap, którego segment nie ma; oferta bez segmentu z podróżą;
obiekcja bez odpowiedzi; treść nie odpowiada na żadne pytanie etapu), **review_flag** (upstream
się zmienił — sprawdź downstream). Health score obszarów zasilany pokryciem etapów (nie liczbą
rekordów) — to zmienia health z „ile mamy" na „czy maszyna jest kompletna".

Propagacja review (rozszerzenie istniejącej): zmiana karty segmentu → flaga na etapach; zmiana
etapu (pytania/trigger/obiekcje) → flaga na elementach, akcjach sprzedażowych i pitchach etapu;
zmiana UVP/oferty → flaga na pitchach i sekcjach stron powiązanych relacjami.

---

## 6. Zmiany w modelu danych (expand → migrate → contract)

**Expand (nowe, nullable — zero ryzyka):**
1. `purchaseStages` + kolumny: `clientDoesMd text`, `ourActionMd text`, `timeHint varchar(100)`,
   `exitCriterion text`, `ownerSide varchar(10) default 'marketing'` (marketing|shared|sales).
2. NOWA tabela `salesActivities(id, stageId→purchaseStages cascade, name, type varchar(50),
   notesMd, toolsMd, orderIdx, status, reviewFlag, deletedAt)` + listDef w registry + typ encji
   `sales_activity` (area: `sprzedaz`) + kolor w ENTITY_TYPE_META.
3. Nowy obszar `sprzedaz` w `StrategyArea` + `AREA_DEPENDENCIES: sprzedaz: ["segmenty","lejek"]`,
   `kpi: [...,"sprzedaz"]` + AREA_META + glyph konstelacji (pokrycie grafu — jak w planie 09).
4. `campaigns.stageId`, `channelActivityPlan.stageId`, `geoQueries.stageId` — nullable FK.
5. Pola pozycjonowania na singletonie business (positioningStatement, nicheMd, antiIcpMd).
6. Nowe relationType: `uzywany_w_etapie`, `prowadzi_do_etapu` (tylko wpisy w RELATION_TYPES —
   entity_relations jest schematless dla typów).

**Migrate (idempotentnie, `scripts/run-sql.ts` — NIE drizzle-kit migrate; journal ma tylko 0000):**
7. `buyerJourneyStages` → `purchaseStages`: match po (segmentId, lower(name)) → update kolumn;
   bez matcha → insert z kolejnym orderIdx. Backup przed migracją (wzorzec migrate-rules-taxonomy).
8. Backfill `stageId` w campaigns/activityPlan tam, gdzie (segmentId + faza) wskazuje dokładnie
   jeden etap; reszta zostaje na fazie do ręcznego przepięcia (review_flag).

**Contract (osobna faza, po weryfikacji):**
9. Drop `buyerJourneyStages` + BuyerJourneyEditor; usunięcie `PHASES` z funnel-board,
   `PHASE_VALUES`-matchingu z auto-relations, STAGES const z route obiekcji; `phase` zostaje
   TYLKO jako tag na purchaseStages (i agregaty).

Dane pre-produkcyjne (RetroHouse, Lumine) — migracja i tak ostrożna, bo to realne strategie robocze.

---

## 7. Elastyczność: „różne strategie w swój sposób"

- **Wszystko opcjonalne poza parą segment+podróż.** Silnik reguł per projekt (`strategyRuleSets`)
  konfiguruje, które luki liczą się do health i które moduły są `onMap` — usługowa firma B2B może
  wyłączyć GEO, e-commerce może wyłączyć sales activities (ownerSide=marketing wszędzie).
- **`strategyPaths` (istnieje)** = warianty strategii: encje z `pathId` pozwalają prowadzić
  równoległe ścieżki (np. „strategia agresywna" vs „organiczna") i porównywać pokrycie etapów.
- **Szablony podróży**: biblioteka startowych podróży (B2B usługi / e-commerce / SaaS) przy
  tworzeniu segmentu — AI dopasowuje do karty ICP, użytkownik edytuje. Zamiast sztywnego wizarda.
- Kierunek przyczynowości jest stały (fundament→…→kpi), ale kolejność PRACY dowolna — locki
  `blockedBy` z reguł są miękkie (ostrzeżenie, nie blokada twarda), jak dziś.

---

## 8. Plan wdrożenia (fazy z bramkami — do Twojej akceptacji)

Konwencje wykonawcze jak w planach 08/09/11: npm (nie pnpm), lint OSOBNO od build,
react-hooks v6 wzorce, select-then-insert, `after()` na fire-and-forget, testy `scripts/test-*.ts`
dopisywane do łańcucha, e2e Playwright, zero zmian palety.

| Faza | Zakres | Rozmiar | Bramka |
|---|---|---|---|
| **N0** | Decyzje + ADR `0012-logika-negacz.md` (otwarte pytania §9) | S | Twoja akceptacja dokumentu |
| **N1 Kręgosłup** | Expand schema (pkt 1–6 §6) + migracja journey (7) + **Journey Designer** + rejestr `sales_activity`/obszar `sprzedaz` w grafie i konstelacji | L | typecheck/lint/test/build + test-journey.ts (merge idempotentny, ownerSide→granica MQL/SQL) + e2e |
| **N2 Funnel 2.0** | Przebudowa funnel-board (kolumny=etapy, drag stageId, szyny, ghost-cells, „dokąd prowadzi") + auto-relations po stageId (Z3) + backfill (8) | L | test-funnel-board.ts (drag zmienia stageId właściwego etapu; sugestie po stageId) + e2e drag |
| **N3 Sprzedaż** | Sales Process Designer + chipy pitch/skrypt per etap + wiersz obiekcji + Blueprint wiersz SPRZEDAŻ + Nitka rozszerzona o sales_activity | M/L | test-blueprint rozszerzony + e2e sales |
| **N4 Spójność** | Gap engine `journeyCoverage` w rules + health po pokryciu etapów + propagacja review W2→W3/W4 + AI-checki sprzeczności + macierz przekazu | M | test-coverage.ts (luki/wyjątki/konfiguracja) |
| **N5 Sprzątanie** | Contract (pkt 9 §6): drop buyerJourneyStages, usunięcie TOFU-struktur, knip | S | pełny gate + grep „TOFU" tylko w tagach/agregatach |

Sekwencja jest bezpieczna: każda faza zostawia aplikację działającą; N5 dopiero po tygodniu pracy
na N1–N4 na realnych projektach.

---

## 9. Otwarte pytania do Twojej decyzji (przed N1)

1. **Merge journey**: match po nazwie etapu (7 w §6) OK, czy wolisz ręczne parowanie w UI
   migracyjnym? (RetroHouse/Lumine mają realne dane w obu tabelach — do sprawdzenia ile koliduje.)
2. **`ownerSide` na etapie vs osobny marker handoff na segmencie** — proponuję ownerSide
   (granica derywowana), bo jedno źródło prawdy; alternatywa: `handoffStageId` na segmencie.
3. **Macierz przekazu**: v1 czysto widokowa (na relacjach) — wystarczy, czy chcesz dedykowaną
   encję `keyMessage` per (segment, etap) od razu?
4. **Widok agregatu lejka po fazach** (4.2 ostatni punkt) — zostawić, czy w ogóle usunąć fazy
   z widoków i zostawić tylko heatmapę kanałów jako agregat?
5. **Kto wdraża**: fazy L (N1, N2) pisane jako spec dla Cursor Composer (wzorzec 08/11),
   czy robimy je tutaj?
6. **salesActivities per etap konkretnego segmentu** oznacza powielanie akcji między segmentami
   o podobnych podróżach — akceptujesz (spójne z „etapy należą do segmentu"), czy chcesz
   bibliotekę akcji + przypięcia? (Proponuję: powielanie + AI „skopiuj proces z segmentu X".)
