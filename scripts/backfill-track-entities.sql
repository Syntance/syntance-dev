-- Backfill track_entities z istniejącego path_id (M0/M1, poprawka #3 planu 2.1).
-- Idempotentny: ON CONFLICT DO NOTHING na unique (track_id, entity_type, entity_id).
-- entity_type w konwencji liczby pojedynczej (jak change_history / entity_comments).
-- Uruchom: pnpm exec tsx scripts/run-sql.ts scripts/backfill-track-entities.sql
--
-- Stan na 2026-07: 0 encji ma niepusty path_id (wszystkie "wspólne" — path_id NULL),
-- więc backfill dziś wstawia 0 wierszy. Uruchamiaj ponownie po każdym przypisaniu
-- encji do konkretnej ścieżki (dopóki nie ma triggera/hooka w warstwie zapisu).

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'business_problem', id, 'owned' FROM business_problems WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'competitor', id, 'owned' FROM competitors WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'objection', id, 'owned' FROM objections WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'segment', id, 'owned' FROM segments WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'channel', id, 'owned' FROM channels WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'sales_pitch', id, 'owned' FROM sales_pitches WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'sales_script', id, 'owned' FROM sales_scripts WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'lead_magnet', id, 'owned' FROM lead_magnets WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'kpi', id, 'owned' FROM kpis WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'strategic_decision', id, 'owned' FROM strategic_decisions WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

INSERT INTO track_entities (track_id, entity_type, entity_id, relation)
SELECT path_id, 'campaign', id, 'owned' FROM campaigns WHERE path_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (track_id, entity_type, entity_id) DO NOTHING;

SELECT entity_type, count(*) FROM track_entities GROUP BY entity_type ORDER BY entity_type;
