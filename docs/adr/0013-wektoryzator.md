# ADR 0013 — Wektoryzator jako Custom App: silnik VTracer w WebAssembly, przetwarzanie w przeglądarce

- **Status:** zaakceptowany
- **Data:** 2026-10-13
- **Kontekst:** Strategy Hub → Custom Apps (`/strategy-hub/apps/wektoryzator`)

## Kontekst

Potrzebne było narzędzie, które z PNG/JPEG robi dokładny wektor, pozwala sterować wyglądem
(liczba kolorów, gładkość krzywych, detale), samo dzieli wynik na warstwy i grupy oraz eksportuje
do formatów używanych w druku, cięciu i projektowaniu. Narzędzie wewnętrzne — za logowaniem huba.

Rozważone silniki:

| Opcja | Jakość kolorowa | Licencja | Uwagi |
|---|---|---|---|
| Potrace (JS/WASM) | tylko 1-bit (kolor przez nakładanie progów) | GPL-2.0 | zarażająca licencja |
| ImageTracer.js | średnia | Unlicense | słabe krzywe na zdjęciach |
| **VTracer 1.0 (WASM)** | wysoka, tryb mozaiki bez szczelin | MIT/Apache-2.0 | oficjalna paczka `@visioncortex/vtracer` |
| Usługa zewnętrzna (Vectorizer.AI) | najwyższa | płatna, API | wysyłka zdjęć klientów poza firmę |

## Decyzja

**1. VTracer 1.0 jako silnik, uruchamiany w Web Workerze w przeglądarce.** Obraz nie opuszcza
komputera (RODO, zero kosztów serwera, brak limitów body na Vercel). Paczka npm jest zbudowana pod
Node (glue czyta `.wasm` przez `fs`), więc `scripts/sync-vtracer.mjs` przepisuje glue na ESM z
`initSync()` i kopiuje binarkę do `public/wasm/vtracer-<wersja>.wasm`. Glue i binarka muszą pochodzić
z tego samego builda — skrypt zapisuje wersję i SHA-256, a worker weryfikuje sumę przed kompilacją.

**2. Własny pre-processing przed silnikiem.** Testy na zdjęciu i logo pokazały, że wbudowana kwantyzacja
VTracer (median cut na regionach) daje mętne barwy. Pipeline: skalowanie przeglądarki (`createImageBitmap`
`resizeQuality: "high"`) → filtr bilateralny w OKLab (szum/JPEG bez rozmycia krawędzi) → k-means++ w OKLab
na histogramie 6-bit (2–256 kolorów albo auto-dobór dla logo) → VTracer z `palette` = nasza paleta.

**3. Mozaika (`hierarchical: cutout`) domyślnie.** Wspólne krawędzie sąsiednich kształtów są dopasowane
raz, więc warstwy według koloru nie mają szczelin i nie nachodzą na siebie — kolejność warstw nie zmienia
wyglądu, można je dowolnie dzielić. Artefakt wygładzania krawędzi (jasne rysy na stykach) usuwa
„wypełniacz szczelin”: obrys 0,6 px w kolorze kształtu (włączony domyślnie, wyłączalny w eksporcie).
Tryb stosu zostaje jako opcja; tam warstwy są ciągłymi wycinkami kolejności rysowania.

**4. Warstwy i grupy liczone po wektoryzacji, bez ponownego śledzenia.** Strategie: auto (tło z krawędzi +
aglomeracja Warda kolorów do N warstw), każdy kolor, jasność, barwa, wielkość, jedna warstwa. Obiekty =
kształty warstwy, których obwiednie stykają się w zadanej odległości (union-find, sweep po osi X).

**5. Wektoryzacja „na żywo” na dwóch workerach.** Po zmianie suwaka drugi worker liczy podgląd
roboczy w 720 px (progi w pikselach skalowane proporcjonalnie, żeby wyglądał jak wynik końcowy), a pełna
jakość startuje po 700 ms bezczynności i podmienia podgląd. Ten sam worker liczy miniatury presetów i podgląd
presetu po najechaniu. Własne presety: localStorage, walidacja Zod przy odczycie.

**6. Obrys całości jako osobny kształt, nie warstwa koloru.** Sylwetka = piksele poza tłem (przezroczystość
albo kolor tła połączony z krawędzią obrazu), opcjonalnie z wypełnionymi otworami, odsunięta dokładną
transformatą odległości (Felzenszwalb) i zwektoryzowana VTracerem. Geometria liczy się w workerze z obrazu
ostatniej wektoryzacji (bez ponownego śledzenia grafiki); kolor, grubość i tryb (linia / podkład) to tylko
renderowanie. Eksport: warstwa „Obrys” w SVG/PDF/EPS/ZIP, warstwa `OBRYS` w DXF (opcja „tylko kontur cięcia”).

**7. Eksport bez ciężkich bibliotek.** SVG (warstwy Inkscape), PDF 1.5 z warstwami OCG, EPS, DXF R12
(polilinie, ACI), PNG (canvas), ZIP warstw (fflate), palety ASE/GPL/CSS/JSON — własne generatory,
pokryte testami struktury (`scripts/test-wektoryzator.ts`).

## Konsekwencje

- Nowe zależności: `zustand` (stan edytora), `fflate` (ZIP + Flate w PDF); dev: `@visioncortex/vtracer`
  (źródło binarki dla skryptu synchronizacji). VTracer jest w wersji `1.0.0-alpha.4` — aktualizacja wymaga
  `pnpm sync:vtracer` i przejścia testów.
- Moduł ładuje się tylko na swojej trasie (worker + ~650 KB WASM), nie dotyka budżetu JS innych stron.
- CSP (`proxy.ts`, Report-Only): zweryfikowane w przeglądarce 2026-10-13 — tworzenie workera i kompilacja WASM
  nie generują żadnych raportów (worker ładuje się z `/_next/static`, poza matcherem proxy, i tam kompiluje WASM).
  Włączenie egzekwowania nie wymaga zmian w polityce dla tego modułu.
- Duże zdjęcia (> 3000 px roboczo, 256 kolorów) mogą generować > 30 tys. ścieżek — podgląd SVG w DOM
  zwalnia; domyślny preset trzyma 2000 px / 128 kolorów.
