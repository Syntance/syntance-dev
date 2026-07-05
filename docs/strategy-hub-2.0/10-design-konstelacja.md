# SPEC DESIGNU: Konstelacja — kierunek wizualny „nocne niebo strategii"

> Warstwa czysto wizualna na strukturze scen z `09-plan-konstelacja-2.0.md` (organizm → obszar → element). Zero zmian w logice, API i danych — wyłącznie prezentacja. Referencja estetyczna: alassafi.ai (ciemne niebo, ciepłe świecące punkty, cienkie gałęzie, elegancki serif w kapitalikach).

## Zasada nadrzędna

Konstelacja to **hero moment** aplikacji — jedyny widok z własną, kinową atmosferą. Cała reszta Huba zostaje bez zmian. Ciemna paleta jest **scope'owana do kontenera widoku** (klasa na rootcie konstelacji), nie do motywu globalnego. Jeden pomysł na widok: „strategia jako gwiazdozbiór" — wszystko inne (panele, breadcrumb, nawigacja) ma być ciche i podrzędne.

## 1. Tokeny (CSS variables na kontenerze `.constellation-root`)

```css
.constellation-root {
  /* tło: ciepła prawie-czerń (NIGDY #000) + winieta ku krawędziom */
  --konst-bg: oklch(0.17 0.012 80);
  --konst-bg-edge: oklch(0.12 0.01 80);
  /* węzły: kość słoniowa z ciepłym halo */
  --konst-node: oklch(0.94 0.045 95);          /* ~#EFE7CE */
  --konst-node-dim: oklch(0.94 0.045 95 / 0.55);
  --konst-halo: oklch(0.88 0.1 90 / 0.12);     /* poświata — nakładane okręgi, nie blur */
  /* krawędzie */
  --konst-edge: oklch(0.92 0.03 90 / 0.3);     /* gałęzie drzewa */
  --konst-edge-cross: oklch(0.92 0.03 90 / 0.16); /* relacje semantyczne (kropkowane) */
  --konst-edge-ai: oklch(0.85 0.06 60 / 0.35); /* relacje od AI — cieplejszy odcień */
  /* typografia */
  --konst-display: oklch(0.92 0.04 95);        /* duże etykiety serif */
  --konst-label: oklch(0.78 0.025 90);         /* mikro-etykiety */
  --konst-muted: oklch(0.62 0.02 88);
  --konst-watermark: oklch(0.92 0.03 90 / 0.07);
  /* skrzydła zależności */
  --konst-up: oklch(0.82 0.05 260);            /* chłodny — „wpływa" */
  --konst-down: oklch(0.85 0.08 80);           /* ciepły — „wynika" */
  /* chrome (pill, panele) */
  --konst-chrome-bg: oklch(0.21 0.012 80);
  --konst-chrome-border: oklch(0.3 0.015 80);
}
```

Zasady:
- **Kolory obszarów** (ringi ikon, akcent fokusu obszaru): istniejące kolory z `ENTITY_TYPE_META` — bez zmian wartości; to jedyne nasycone kolory na scenie.
- **Kolory typów encji NIE barwią węzłów** na poziomie organizm/obszar (wszystkie punkty = kość słoniowa, jak referencja). Kolor typu pojawia się dopiero: (a) jako cienki ring węzła na poziomie „element" (centrum sceny), (b) w panelu encji, (c) w legendzie.
- Statusy: mikro-ring 1px wokół węzła tylko dla `review` (żółty `#FACC15` — istniejący) i `empty` (czerwonawy, opacity 0.7). `ready` = brak ringu (czysty punkt). Nie kolorujemy wypełnień.
- Kontrast: `--konst-label` na `--konst-bg` ≥ 4.5:1 (sprawdzić po implementacji); watermark i starfield są dekoracyjne (`aria-hidden`).

## 2. Tło i atmosfera

- **Winieta**: radial-gradient CSS od `--konst-bg` (centrum) do `--konst-bg-edge` (krawędzie) na kontenerze — statyczna, poza SVG.
- **Starfield**: 120–180 punktów 1–1.5px, opacity 0.12–0.28, pozycje deterministyczne (seeded PRNG z `projectId` — bez migotania między renderami). Warstwa `<g aria-hidden>` pod grafem, NIE animowana (ewent. bardzo wolny drift 60s na transform całej grupy; reduced-motion: statyczna).
- **Orbity**: 2–3 koncentryczne okręgi wokół rdzenia, stroke 1px, opacity 0.04–0.06 — kotwiczą kompozycję (widoczne na poziomie organizm).
- ZERO gradientów na węzłach, zero neonów, zero blur na dużych powierzchniach (wydajność). Poświata węzła = 1–2 dodatkowe okręgi o niskiej opacity (jak w makietach), a `feGaussianBlur` wyłącznie na JEDNYM elemencie naraz — fokusowanym węźle.

## 3. Węzły

| Element | Wygląd |
|---|---|
| **Rdzeń (biznes)** | „Rozbłysk": 40–70 drobin 0.7–2.5px w klastrze r≈30px, pozycje seeded z projectId; 85% kość słoniowa + 10% bursztyn `oklch(0.78 0.12 75)` + 5% miedź `oklch(0.66 0.12 50)`. Pod spodem 2 okręgi halo (r 16/30, opacity 0.1/0.06). Puls: skala 1→1.03, 8s, tylko na poziomie organizm; reduced-motion: statyczny. |
| **Węzeł obszaru** | Okrąg r16 (fokus: r18), fill `--konst-chrome-bg`, ring 1.5–2px w kolorze obszaru; w środku **custom glif** (patrz §5). Drugi ring (opacity 0.3, r+5) tylko dla obszaru fokusowanego. Ring statusu maszyny stanów: krótki łuk (dasharray) w kolorze statusu na obwodzie — subtelny, 270°→score%. |
| **Encja (punkt)** | Wypełniony okrąg, r zależny od wagi (liczba krawędzi): 2–3.5px (organizm), 3–5px (obszar), bez ringu typu. Hover/fokus: r+1.5 + pojedyncze halo + etykieta. |
| **Encja centrum sceny „element"** | r 14, fill chrome, ring 2px w kolorze TYPU encji (jedyne miejsce z kolorem typu na scenie), glif typu w środku, halo. |
| **Agregat „+N"** | Punkt r3 z etykietą `+12` w `--konst-muted` — styl identyczny jak encje, bez ringów. |

## 4. Krawędzie

- **Gałęzie drzewa**: linie proste lub minimalny łuk (quadratic, strzałka ugięcia ≤ 8px — referencja ma niemal proste odcinki), 1px, `--konst-edge`. Bez strzałek na poziomie organizm/obszar.
- **Relacje semantyczne (cross)**: kropkowane `stroke-dasharray: 2 4`, `--konst-edge-cross`; od AI: `--konst-edge-ai`. Widoczne od zoomu ≥ 0.7 lub przy fokusie węzła (LOD bez zmian).
- **Krawędzie do skrzydeł** (scena obszar/element): kropkowane, w tincie skrzydła (`--konst-up`/`--konst-down`, opacity 0.4), z mikrostrzałką (marker 4px) wskazującą kierunek przyczyna→skutek.
- Podświetlenie ścieżki (focus_map_node mode=path): krawędzie ścieżki przechodzą na pełną opacity + kolor `--konst-down`, reszta sceny przygasa do 0.25.

## 5. Ikony obszarów — custom glify (zero-stock)

Zestaw **7 autorskich glifów** (stroke 1.3–1.5px, grid 12×12, zaokrąglone końcówki, styl „gwiezdny minimalizm"), zamiast Lucide:
fundament = trójkąt/kamień węgielny · segmenty = trzy orbitujące punkty · lejek = klepsydra-strumień (jak w makiecie) · kanały = strzałka rozgałęziona · przekaz = fala/sygnał · strona = ramka z linią hero · KPI = trzy słupki wznoszące. Plik: `components/strategy-hub/constellation/area-glyphs.tsx` (czyste `<path>`, props `size`, `strokeWidth`). Te same glify w breadcrumbie i nawigatorze.

## 6. Typografia

- **Display (nazwy obszarów, watermark)**: serif z klasą — **Fraunces** (variable: opsz, wght 300–420, `next/font/google`, subset latin-ext, `display: swap`, ładowany TYLKO w route konstelacji — nie wchodzi do global bundle). Uzasadnienie: opozycja serif↔sans daje „głos" widoku (reszta Huba = sans), optical size gra przy 96px watermarku i 30px etykiecie.
- **Etykieta aktywnego obszaru** (dół ekranu): Fraunces 300, uppercase, `letter-spacing: 0.35em`, `clamp(24px, 4vw, 40px)`, kolor `--konst-display`; pod spodem podtytuł: sans Huba, 11–12px, `tracking 0.18em`, `--konst-muted`, elementy oddzielone ` · `.
- **Watermark** (scena obszar): Fraunces 300 uppercase, `clamp(72px, 14vw, 140px)`, `--konst-watermark`, za grafem, `aria-hidden`, przycięty do kontenera.
- **Mikro-etykiety encji**: sans Huba 11px, `tracking 0.12em`, `--konst-label`; pojawiają się od zoomu ≥ 0.9 / hover / fokus (fade 150ms). Nigdy nie nachodzą na węzły (offset 8px, anchor od strony zewnętrznej gałęzi).
- **Nagłówki skrzydeł**: „WPŁYWA" / „WYNIKA" — sans 11px, tracking 0.3em, w tincie skrzydła.

## 7. Chrome widoku

- **Breadcrumb-pill** (góra, wyśrodkowany): kapsuła `--konst-chrome-bg` + border 0.5px `--konst-chrome-border`, 24px wysokości; treść: `Biznes → Lejek → Webinar` (poziomy klikalne) + separator `·` + health/score obszaru. Na poziomie organizm pill pokazuje `Biznes · zdrowie N%`.
- **Strzałki obszarów** `‹ ›`: przyciski ghost 40×40, znak w `--konst-label`, hover → `--konst-display`; pozycja: boki dolnej etykiety (jak referencja).
- **Panel encji** (prawa strona): półprzezroczysty `--konst-chrome-bg` z `backdrop-filter: blur(8px)` (fallback: pełny kolor), border-left 0.5px, szerokość 320px, slide-in 200ms. Wewnątrz obowiązuje typografia i kolory PANELU (jasne teksty na chrome), akcent koloru typu encji jako 2px kreska przy nagłówku.
- **Legenda** (dolny lewy róg, zwijana): mini-słownik — punkt=encja, ring kolor=obszar, kropkowana=relacja, ciepła kropkowana=relacja od AI, żółty ring=do przeglądu.
- **Wejście klienta (mode=client)**: bez przycisku „Dodaj relację" i akcji edycyjnych; reszta identyczna. Tryb prezentacji: chrome znika (auto-hide po 3s bezczynności), zostaje graf + etykieta obszaru.

## 8. Motion (Motion/Framer — istniejący stack)

| Moment | Animacja | Czas/easing |
|---|---|---|
| Wejście na widok | gałęzie „wyrastają" od rdzenia: `pathLength 0→1` + punkty fade-in, stagger 15ms/węzeł, max 800ms całość | `easeOut` |
| Zmiana sceny (drill-down) | kamera spring do celu (istniejący use-camera) + crossfade elementów sceny 250ms; watermark fade-in 400ms z opóźnieniem 150ms | spring `stiffness 120, damping 20` |
| Hover węzła | r +1.5px, halo opacity 0→0.12, etykieta fade 150ms | `easeOut 150ms` |
| Fokus z czatu | jak drill-down + 2 pulsy ringu celu (600ms) | — |
| Puls rdzenia | scale 1→1.03, 8s, loop | `easeInOut` |
| `prefers-reduced-motion` | wszystkie powyższe → natychmiastowe przejścia bez springów, pulsów i draw-in; crossfade ≤ 100ms | — |

Animowane wyłącznie `transform`/`opacity`/`pathLength`. Draw-in tylko przy pierwszym wejściu (nie przy każdej zmianie sceny).

## 9. Mapowanie na pliki (implementacja)

| Plik | Zakres zmian |
|---|---|
| `components/strategy-hub/constellation/constellation-view.tsx` | tokeny na rootcie, winieta, starfield (seeded), watermark, chrome (pill/strzałki/legenda), LOD etykiet |
| `constellation-node.tsx` | style węzłów wg §3 (rozmiar od wagi, halo bez blur, ringi statusów/obszarów), glify |
| `constellation-edge.tsx` (lub inline) | style krawędzi §4, markery kierunku, podświetlenie ścieżki |
| `scene-layout.ts` | offsety etykiet (anchor zewnętrzny), pozycje skrzydeł z nagłówkami |
| `area-glyphs.tsx` (NOWY) | 7 custom glifów §5 |
| `core-panel.tsx`, `entity-panel.tsx` | chrome §7 (blur, akcent typu) |
| `area-navigator.tsx` | strzałki + duża etykieta serif + podtytuł |
| route `constellation/page.tsx` | `next/font` Fraunces (scoped), zmienna `--font-konst-display` |
| `use-camera.ts` | bez zmian logiki; parametry springa §8 |

Bez zmian: dane, API scen, store, testy logiki. Playwright: dopisać asercję `prefers-reduced-motion` (brak animacji) i widoczność etykiety obszaru.

## 10. Detale kompozycji scen (v2 — kierunek zaakceptowany przez użytkownika)

Doprecyzowania po drugiej iteracji makiet (organizm / obszar / element):

**Scena „organizm":**
- Każdy klaster obszaru ma **podpis** przy zewnętrznej krawędzi: sans 11px, tracking 2.5px, uppercase, `--konst-muted`, opacity 0.75 (jak CREATION/REPURPOSING w referencji). Pozycja: od strony „zewnętrza" ekranu, nie nachodzi na gałęzie.
- Gałęzie mają **pod-odgałęzienia** (chain: węzeł→węzeł→stub 1–2 punktowy) i malejące promienie punktów wzdłuż łańcucha (2.6 → 1.6px) — daje organiczny, „dendrytowy" rysunek zamiast wachlarza z jednego punktu.
- **Obszar fokusowany** (ten z dolnej etykiety): jaśniejsze gałęzie (edge opacity 0.5 vs 0.22) i jaśniejsze punkty (`#F4EDD6`), podwójny ring węzła. Strzałki ‹ › przełączają fokus BEZ zmiany sceny; Enter/klik wchodzi do sceny obszaru.
- Rdzeń: dodatkowo 5–6 **promienistych iskier** (linie 1px, opacity 0.08, długość ~25px) wychodzących z klastra drobin.
- Orbity: 3 pierścienie (r ~92/152/212 przy viewporcie 680) opacity 0.05/0.04/0.03.

**Scena „obszar":**
- Obszary z naturalną sekwencją dostają **kręgosłup** zamiast czystego radialu: dla LEJKA — 4 węzły etapów (r5, cream) po ukośnej linii od węzła obszaru w górę, elementy odgałęziają się od swojego etapu; **mikro-podpisy etapów** (ŚWIADOMOŚĆ/ROZWAŻANIE/DECYZJA/RETENCJA — 11px, tracking 2.5, opacity 0.8) po zewnętrznej stronie kręgosłupa. Analogicznie: KANAŁY — grupowanie po typie kanału; STRONA — po witrynie/sekcji. Obszary bez sekwencji (fundament, segmenty, KPI, przekaz) — klasyczny radial.
- Etykiety elementów: widoczne dla wszystkich węzłów r ≥ 3 (scena ma mało węzłów — LOD łagodniejszy niż na organizmie); element fokusowany: etykieta w `--konst-label` jaśniejszym (`#CFC7AC`) + halo.
- Skrzydła: 3–4 najważniejsze węzły na stronę (cap ze spec 09 pozostaje), each z podpisem `Typ: nazwa` (np. „Segment: MŚP B2B"); nagłówki WPŁYWA/WYNIKA tracking 3.5px.
- Status `review`: żółty ring na punkcie elementu (jak w makiecie — Case study).

**Scena „element":**
- Watermark = nazwa encji (pierwsze słowo / skrót do 10 znaków), 72px.
- Krawędzie do skrzydeł: łuki beziera (nie proste) z markerem strzałki 6px w tincie skrzydła; **etykieta relacji na krawędzi**: 11px italic, w przyciemnionej tincie skrzydła (`#8D9BC0` / `#C6A876`), pozycjonowana w 1/3 długości łuku, bez tła.
- Centrum: ring koloru TYPU encji (np. element = `#34D399`) + zewnętrzny ring opacity 0.3 + halo; glif typu w środku.
- Dolna etykieta: nazwa encji w Fraunces (uppercase, tracking 9px, clamp 20–28px) + linia meta (typ · etap · liczby zależności).
- Skrzydła do 4 węzłów na stronę; klik węzła skrzydła = przejście do JEGO sceny element (breadcrumb się wydłuża/wymienia ostatni segment).

## 10a. Model interakcji v3 (zaakceptowany 2026-07-05 — nadpisuje wcześniejsze zasady tam, gdzie kolidują)

- **Organizm = kategorie + luźne punkty, ZERO korelacji.** Na scenie organizmu widoczne są wyłącznie nici rdzeń↔obszar. Żadnych krawędzi do/między elementami (tree ani cross). Elementy to mała „masa kropek" **rozsiana w przestrzeni** (nie drzewo radialne wokół planety): każda encja dostaje pozycję w sektorze swojego obszaru z seedowanym rozrzutem (kąt ±44% sektora, promień 310–500).
- **Dryf:** punkty encji na organizmie powoli dryfują (CSS `konst-drift`, amplituda 2–6px, czas 6–14s, seed z id węzła; `prefers-reduced-motion` wyłącza). Przy zoomie ≥ 0.9 punkty **stabilizują się**: dryf znika, promień rośnie (2.6→4.5+), pojawiają się etykiety.
- **Klik obszaru** = wejście w scenę obszaru (graf wpływu/efektu ze skrzydłami WPŁYWA/WYNIKA) — bez zmian.
- **Klik elementu** (na każdej scenie) = panel informacyjny po prawej (EntityPanel), NIE nawigacja. Scena grafu elementu dostępna z panelu przyciskiem **„Graf zależności"** oraz przez focus z czatu.
- Implementacja: scatter w `scene-layout.ts` (organizm), dryf w `constellation-node.tsx` + keyframes w `globals.css`, stabilizacja przez `useMotionValueEvent(camera.scale)` w `constellation-view.tsx`.

## 11. Definition of Done (bramka wizualna)

1. `npm run typecheck && npm run lint && npm run build` zielone; bundle route konstelacji < 200 KB initial JS (Fraunces nie wchodzi do global bundle — sprawdzić `npm run analyze`).
2. Kontrast zweryfikowany: `--konst-label`/`--konst-display` na tle ≥ 4.5:1; elementy czysto dekoracyjne mają `aria-hidden`.
3. 60 fps przy pan/zoom na scenie 150+ węzłów (DevTools performance, throttling CPU 4×) — brak animacji layoutu, tylko transform/opacity.
4. Reduced-motion: zero ruchu poza natychmiastowymi przejściami.
5. Zrzuty trzech scen (organizm/obszar/element) porównane z makietami z rozmowy — zgodny klimat: ciepłe punkty, cienkie gałęzie, serif z trackingiem, watermark.
