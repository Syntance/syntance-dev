# ADR 0007: Embeddingi Voyage AI + pgvector

## Status

Zaakceptowane (2026-07)

## Kontekst

Mózg strategii wymaga wyszukiwania semantycznego i auto-relacji opartych o podobieństwo treści encji.

## Decyzja

1. Provider: Voyage AI `voyage-3.5`, 1024 wymiary, batch ≤128, timeout 10s.
2. Storage: tabela `entity_embeddings` z pgvector + indeks HNSW (`vector_cosine_ops`).
3. Indeksacja: hash SHA-256 treści → skip gdy bez zmian; trigger przez `trackChange` + cron reconcile.
4. Degradacja: brak `VOYAGE_API_KEY` → null + jedno ostrzeżenie w logu, aplikacja działa bez embeddingów.

## Konsekwencje

- Endpoint `POST .../semantic-search` wymaga dokładnie jednego z: `query` | `entityRef`.
- Cron `/api/strategy-hub/embeddings/cron` codziennie 4:00 (vercel.json).
