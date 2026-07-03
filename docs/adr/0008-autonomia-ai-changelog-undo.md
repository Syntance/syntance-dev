# Autonomia AI + changelog z undo

## Kontekst

Strategy Hub przechodzi z modelu „propozycja → akceptacja” na pełną autonomię AI z możliwością cofnięcia batcha.

## Decyzje

1. **`before_json` (jsonb)** obok `old_value` (tekst) — undo wymaga typów natywnych (liczby, JSONB, daty).
2. **`batch_id`** grupuje zmiany z jednego przebiegu czatu/agenta; undo operuje na batchu.
3. **Last-write-wins** przy konflikcie undo vs późniejsze edycje — akceptowalne przy zespole 1–2 os.
4. **`reviewFlag`** na encjach po zmianach treści przez agenta w tle (bezpiecznik wizualny).
5. Relacje AI: `confidence` + próg 0.75 dla auto-`powiazany_z` w cronie (embeddingi).

## Konsekwencje

- Usunięto `accept-proposal.ts` i endpoint accept/reject.
- MCP: `undo_batch` zamiast accept/reject.
- Cron agenta: auto-relacje + tryby monitor/audit.
