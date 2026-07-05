# ADR 0011: Widoki strategii — nitka, blueprint, warstwa decyzji

## Status

Zaakceptowane — 2026-07-05

## Kontekst

Strategy Hub potrzebuje trzech uzupełniających widoków odpowiadających na pytania: „jak X wpływa na Y end-to-end" (nitka), „czy maszyna segmentu jest kompletna" (blueprint segmentu), „z czego to wynika" (warstwa decyzji).

## Decyzje

1. **Trzy widoki, jeden nowy punkt nawigacji** — Blueprint w menu bocznym; nitka jako tryb konstelacji (`?thread=`); warstwa decyzji jako overlay (`?decisions=1` / szuflada) bez osobnego wpisu menu.
2. **Selektor segmentu współdzielony** — URL `?segment=`; ten sam komponent w blueprincie i nitce.
3. **Decyzje na krawędziach nitki** — `decisionLinks` cause/effect; brak decyzji → fallback `rationaleMd` relacji („decyzja lekka").
4. **Oś kanoniczna nitki** — segment → problem → stage → element → flow → page → section → kpi; pozostałe typy poza osią.
5. **Luki blueprintu z relacji** — komórki wypełniane z `funnelElements` + `entity_relations`; wyjątek retencji dla luk kanał/strona.

## Konsekwencje

- Zero migracji DB — istniejące tabele wystarczają.
- Portal klienta: blueprint + nitka read-only; decyzje tylko editor.
- Testy integracyjne: `scripts/test-thread.ts`, `scripts/test-blueprint.ts`, E2E blueprint + rozszerzenie constellation.
