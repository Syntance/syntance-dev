# ADR 0003 — Multi-site przez nullable siteId z domyślnym primary site

## Status

Zaakceptowany (Faza 2 Strategy Hub 2.0)

## Kontekst

Projekt Strategy Hub zakładał jedną stronę WWW per projekt (`pages`, `nav_items`, `seo_keywords`, `site_audits` scoped wyłącznie po `projectId`). Klienci mają coraz częściej wiele witryn: główna domena, landingi, microsite'y, sklepy. Potrzebujemy modelu N stron bez regresji dla istniejących danych (RetroHouse, Lumine).

## Decyzja

1. **Nowa tabela `sites`** — encja listowa per projekt: `name`, `domain`, `type`, `status`, `isPrimary`, soft-delete.
2. **Nullable `siteId`** na `pages`, `nav_items`, `seo_keywords`, `site_audits` — FK `ON DELETE SET NULL`; brak wymogu natychmiastowego wypełnienia przy deployu schematu.
3. **Primary site per projekt** — migracja `0011_multisite.sql` (idempotentna) tworzy rekord `isPrimary = true` (`name` = `projects.name`, `domain` z `projects.domain`) dla projektów bez primary site; następnie `UPDATE … SET site_id = primary` dla rekordów z `site_id IS NULL`.
4. **Skrypt zapasowy** — `scripts/seed-primary-sites.ts` powtarza ten backfill (np. dev bez migracji).
5. **Filtr opcjonalny** — API entity (`?siteId=`) i UI `/execution/sites?site=` filtrują podwidoki; bez parametru listy zwracają wszystkie rekordy projektu (kompatybilność wsteczna).
6. **Primary site w UI** — przy wyborze primary site pokazujemy też rekordy z `site_id IS NULL` (bezpiecznik przed niepełnym backfillem).

## Konsekwencje

- **Pozytywne:** zero breaking change dla health-score / mapy (nadal liczą pages po `projectId`); istniejące podstrony przypięte do primary site po migracji; przełącznik stron w Egzekucji.
- **Negatywne:** `tech_stack` i `site_maintenance_costs` pozostają per projekt (nie per site) — świadomy scope Fazy 2; GEO assets (`siteId`) dopiero Faza 4.
- **Migracja:** ręczny SQL `db/migrations/0011_multisite.sql`; nie `db:push` na prod bez review.

## Alternatywy odrzucone

- **Osobna tabela per site dla pages** — zbyt duży refactor; duplikacja relacji `page_sections`.
- **Wymuszony NOT NULL siteId od razu** — ryzyko dla istniejących wierszy i kolejności deployu (schema vs backfill).
- **Site jako JSON w `projects`** — brak relacji FK, gorsze filtrowanie i CRUD przez registry.
