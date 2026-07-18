-- 0026 — B3 (logika Negacza): nisza / specjalizacja + anty-ICP na pozycjonowaniu.
-- Idempotentna (IF NOT EXISTS) — konwencja repo, uruchamiana przez scripts/run-sql.ts.

ALTER TABLE brand_positioning
  ADD COLUMN IF NOT EXISTS niche_md text,
  ADD COLUMN IF NOT EXISTS anti_icp_md text;
