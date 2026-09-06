# ADR 0012 — Organizacja zamiast workspace; projekt jako jednostka strategii

- **Status:** zaakceptowany
- **Data:** 2026-09-06
- **Kontekst:** Strategy Hub 2.1, hierarchia klient → projekty

## Kontekst

`projects` sklejał trzy niezależne role:

1. **kto płaci** — time tracking, stawki godzinowe, `project_clients`, token dostępu klienta, hosting, domeny, Notion,
2. **czyja jest strategia** — 55 tabel z `project_id`,
3. **co budujemy** — `sites` (już wielokrotne w projekcie).

Nad tym stał `workspaces` = konto agencji, z tenantem rozstrzyganym przez
`workspaces.owner_email UNIQUE` i `AdminUser.workspace_id` (jeden admin = jeden
workspace). Nie było poziomu, na którym mieści się „klient z kilkoma gałęziami
lub produktami": firma z jedną stroną i wieloma usługami wyglądała tak samo jak
firma z osobnymi bytami per produkt.

Diagnostyka bazy referencyjnej przed decyzją:

- 91 workspace'ów, z czego **88 to śmieci** zostawione przez `scripts/test-*.ts`,
- `path_id` używane w **0 wierszach** we wszystkich 12 tabelach, `track_entities` — 0 wierszy,
- 3 realne konta admina, każde `role='owner'` w swoim workspace.

## Decyzja

**1. Organizacja zastępuje workspace jako granica tenanta.** `workspaces` →
`organizations` (RENAME, dane zostają). Organizacja = klient agencji.
Poziomów są dwa, nie trzy: nie ma tabeli „agencja" — agencja to zbiór adminów.

**2. Dostęp wyłącznie przez `organization_members`.** Jeden admin należy do
wielu organizacji; rola `owner`/`member` jest rolą **w organizacji**, nie
globalną. `owner_email` traci unikalność i nie autoryzuje. Odrzucono wariant
„owner widzi wszystkie organizacje": byłaby to regresja izolacji, tego samego
rodzaju co wyciek multi-tenant w `/sync` złapany audytem 2026-07.

**3. Strategia zostaje w projekcie; organizacja jej nie trzyma.** Projekt niesie
`kind` (`firma` | `galaz` | `produkt`), opcjonalny `parent_project_id` i
`strategy_mode` (`wlasna` | `dziedziczona`). Dzięki temu **55 tabel z
`project_id` pozostaje nietkniętych** — nie ma kolumn XOR, nie ma duplikatów
tabel na poziomie organizacji, żaden silnik nie musi robić UNION-ów.
„Centralna strategia organizacji" = projekt `kind='firma'` z trybem `wlasna`,
a produkty to projekty `dziedziczona` wskazujące na niego.

**4. Dziedziczenie jest read-through, nie kopiowaniem.** Projekt
`dziedziczona` czyta encje fundamentu (W0: problemy biznesowe, UVP,
pozycjonowanie, konkurenci, marka, copy guidelines, oferty) z najbliższego
przodka o trybie `wlasna`. Rynek, podróż zakupowa, lejek, kanały, strony, KPI
i cały delivery są **zawsze** lokalne. Zapis do fundamentu w trybie
dziedziczonym jest blokowany (409), a nie przekierowywany do rodzica — edycja
„w imieniu rodzica" po cichu zmieniałaby strategię rodzeństwa.

**5. „Odłącz fundament" kopiuje dane, potem przełącza tryb.** Read-through
znaczy, że projekt dziedziczący nie ma własnych wierszy; samo ustawienie
`wlasna` zostawiłoby go z pustką, którą użytkownik odczytałby jako utratę
danych. `lib/strategy-hub/fork-foundation.ts` materializuje to, co było widoczne.

**6. Ścieżki strategii (`strategy_paths`) ZOSTAJĄ** jako oś prostopadła:
warianty tej samej strategii **wewnątrz** jednego projektu (rynek PL vs DE).
Podział firma / gałąź / produkt robimy projektami, nie ścieżkami. Ścieżka
nigdy nie wychodzi poza swój projekt.

**7. Runner migracji dostaje rejestr `schema_migrations`.** Dotąd odtwarzał
wszystkie pliki przy każdym uruchomieniu, polegając na `IF NOT EXISTS`
i połykaniu „already exists". To uniemożliwia jakąkolwiek migrację
nieidempotentną — `RENAME`, `DROP COLUMN`, backfill — bo drugi przebieg wywraca
się na nieistniejącym obiekcie. Migracja 0030 jest dokładnie takim przypadkiem.
Istniejąca baza jest bootstrapowana: migracje ≤ 0029 zostają oznaczone jako
zastosowane, jeśli baza jest niepusta.

## Rozważone i odrzucone

| Wariant | Dlaczego odpadł |
|---|---|
| Organizacja jako trzeci poziom **nad** workspace | Trzy poziomy dla jednego klienta z jednym projektem = dwa puste kliknięcia; workspace i tak nie miał już własnej roli. |
| Encje strategii z `organization_id` (XOR z `project_id`) | Dotyka 55 tabel, wymusza UNION w każdym silniku (health score, graf, embeddingi, eksporty) i tworzy dwuznaczność „czyja jest ta encja". |
| Drzewo w jednej tabeli bez `organizations` | Nie daje granicy tenanta ani miejsca na dostępy klienta i branding. |
| Kopiowanie fundamentu zamiast read-through | Nie wymaga zmian w silnikach, ale rozjeżdża się w czasie — „centralna strategia" przestaje być centralna po pierwszej edycji. |
| `kind = 'rynek'` dla wariantów rynkowych | Zbędne — od tego są ścieżki strategii, które zostają. |

## Konsekwencje

**Pozytywne**

- Każdy klient ma własny branding portalu (`organization_branding` zamiast jednego wspólnego dla agencji).
- Zaproszenie admina do wielu klientów przestaje być obejściem, staje się modelem.
- Widok organizacji daje podsumowanie, którego wcześniej nie było gdzie umieścić.

**Koszty i ryzyka**

- Faza 1 przepina granicę tenanta — najbardziej wrażliwy fragment. Wymaga testów e2e na dostępach **przed** wdrożeniem na produkcję.
- RLS pozostaje permissive-by-default (fail-open) — bez zmian względem ADR 0005; migracja 0030 tylko przenosi klucz sesji `app.workspace_id` → `app.organization_id`.
- `AdminUser.organization_id` oraz `channels.workspace_id` zostają jako kolumny `@deprecated` do fazy sprzątającej — DROP dopiero w osobnym deployu, zgodnie z expand→contract.

### Zasięg dziedziczenia (stan domknięty)

Wszystkie ścieżki czytające W0 rozwiązują dziś projekt-źródło: API fundamentu
(8 encji + generyk `[entity]`), health score, mapa strategii, canvas, konstelacja
(dane, sceny, podsumowanie encji), graf relacji, eksporty, sync z Notion, portal
klienta, narzędzia AI i MCP, rejestr decyzji, nitka.

Zapis do W0 przy dziedziczeniu jest **odmawiany** (409 / obiekt błędu), nigdy
przekierowywany do rodzica — w route'ach API, w narzędziach AI i MCP, w agencie
(`applyDraft`) oraz w pullu z Notion. Powód jest jeden: zapis „w imieniu rodzica"
po cichu zmieniłby strategię rodzeństwa i wnuków, a zapis lokalny trafiłby do
wiersza, którego po tej zmianie nikt już nie odczytuje.

### Rozstrzygnięte przy okazji

**Oferta ↔ segment przy dziedziczeniu: relacja jest LOKALNA.** Oferta pochodzi
z fundamentu, ale to, do jakich segmentów celuje, jest decyzją konkretnego projektu —
wiersz `entity_relations` nosi `projectId` dziecka, więc nie wycieka do rodzeństwa,
a oferta jest w tym projekcie widoczna (czytamy ją ze źródła), więc `sourceId` nie
jest sierotą. To także pożądane produktowo: ta sama oferta może celować w inne
segmenty w każdej gałęzi. Walidujemy istnienie oferty w projekcie-źródle, a segmentów
lokalnie. Odrzucony wariant: zapis w projekcie-źródle — przepisałby przypisania
całemu rodzeństwu, a lokalne id segmentów i tak by tam nie istniały.

**Ścieżki na encjach dziedziczonych: filtr wariantowy jest pomijany.** Ścieżki
należą do projektu oglądającego, więc nigdy nie zrównają się ze ścieżkami źródła —
z filtrem przechodziłyby wyłącznie encje z `path_id IS NULL`, a reszta znikałaby
po cichu mimo istnienia w źródle. Przy `inherited` pokazujemy cały fundament.
Dotyczy `businessProblems` i `competitors` (tylko one z W0 mają `path_id`).

### Znane ograniczenia

- **Embeddingi.** Encje W0 są indeksowane raz, pod projektem-właścicielem. Wyszukiwanie
  semantyczne zawężone do projektu dziedziczącego nie zwróci dziedziczonego fundamentu —
  alternatywą byłaby duplikacja wektorów, świadomie odrzucona.
- **`strategy_rule_sets`** nie ma kolumny organizacyjnej: zakres `global` to domyślne
  reguły agencji, wspólne dla wszystkich klientów. Lista nadpisań per projekt jest już
  zawężona do bieżącej organizacji.
- **Kolumny do usunięcia w fazie contract:** `AdminUser.organization_id`,
  `channels.workspace_id`. Kod ich nie używa, ale DROP musi pójść osobnym deployem —
  inaczej łamiemy expand→contract i tracimy ścieżkę wycofania.

## Powiązane

- `docs/adr/0005-rls-rollout.md` — status RLS
- `docs/strategy-hub-2.0/02-model-danych.md` — model danych 2.0
- `docs/strategy-hub-2.0/12-logika-strategii-negacz.md` — warstwy W0–W6, z których wynika granica fundamentu
- Migracje `0030`–`0033`
