# SPEC WDROŻENIOWA: Strategy Hub → „Mózg strategii"

> Dokument wykonawczy dla agenta implementującego (Cursor Composer). Po zatwierdzeniu zapisać do `docs/strategy-hub-2.0/08-plan-mozg-graf.md`.
> Wykonuj fazy ŚCIŚLE po kolei: **A → B → C → D → E → F**. Po każdej fazie uruchom bramkę jakości (sekcja „Bramka" na końcu fazy). Nie przechodź dalej przy czerwonej bramce.

## Zasady globalne (obowiązują w każdej fazie)

- Stack: Next.js 16 App Router, React 19, TypeScript **strict** (zero `any`, zero `as` jako ucieczki), Tailwind v4, Drizzle ORM (Postgres/Neon), Zod v4 (styl jak w `lib/strategy-hub/entities/registry.ts` — np. `z.string().uuid()`, `md()` helper).
- Menedżer pakietów: **npm** (jest `package-lock.json`). Komendy: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, migracje: `npm run db:migrate:apply` (przeczytaj `scripts/run-migration.ts`, jak przyjmuje plik migracji).
- Migracje SQL: ręczne pliki `db/migrations/00NN_nazwa.sql` (kontynuuj numerację po najwyższym istniejącym numerze; sprawdź katalog przed nadaniem numeru — poniżej założono 0021+).
- Każdy endpoint: walidacja Zod na wejściu + `requireProjectAccess` (wzorzec z `lib/strategy-hub/api-helpers.ts` i istniejących route'ów `app/api/strategy-hub/projects/[id]/...`).
- Każdy fetch zewnętrzny: `AbortSignal.timeout(...)`.
- Komentarze i etykiety UI po polsku (konwencja repo). **Nie zmieniaj palety kolorów aplikacji** — kolory encji wyłącznie z istniejącego `ENTITY_COLORS`.
- Komponenty grafowe: `"use client"` + ładowanie przez `next/dynamic` z `ssr: false` (wzorzec: pozostałe widoki mapy). RSC wszędzie indziej.
- Nowe widoki: nawigacja klawiaturą + `prefers-reduced-motion` (WCAG 2.2 AA).
- Nie ruszaj plików niezwiązanych z fazą. Nie zmieniaj istniejących testów poza jawnie wskazanymi.

## Kontekst — co już istnieje (zweryfikowane)

| Obszar | Fakty |
|---|---|
| Rejestr encji | `lib/strategy-hub/entities/registry.ts` + `extended-registry.ts`: `ListEntityDef { createSchema, patchSchema, list, create, update, softDelete }`, `SingletonEntityDef { patchSchema, get, upsert }`; dynamiczne route'y `[entity]` dispatchują po kluczu. **Server-only.** |
| Audyt zmian | `lib/strategy-hub/track-change.ts`: `trackChange({ projectId, entityType, entityId, patch, source, userId })` — wpis per pole do `change_history`; `oldValue` ZAWSZE `null` (linia 82); wartości serializowane do TEKSTU (`serializeValue`); mapa `ENTITY_TYPE_MAP` (klucz registry l.mn. → entityType l.poj.); pola ignorowane: updatedAt/createdAt/orderIdx; MAX_FIELDS=12; błędy połykane. |
| Realtime | SSE `app/api/strategy-hub/projects/[id]/live` polluje `change_history` co 2 s → event `changed` → refetch w UI (`lib/strategy-hub/use-live-updates.ts`). Każdy zapis przez `trackChange` propaguje się sam. |
| Grafy UI | `lib/strategy-hub/relation-graph.ts` (`getRelationGraphData` — 12 typów, lokalna mapa `COLOR`), `components/strategy-hub/strategy-map/relation-graph.tsx` (React Flow, drag, zapis pozycji do `projects.graphLayout` JSONB), `map-view.tsx` (7 modułów L1: fundament/segmenty/lejek/kanaly/przekaz/strona/kpi), `influence-view.tsx`, switcher `strategy-map.tsx` (tryby list/map/influence + `mode: "editor"|"client"` + tryb prezentacji po `presentationOrder`). |
| Tabele join do zastąpienia | `funnelElementChannels`, `funnelElementKpis`, `funnelElementCampaigns`, `funnelElementGeo`, `userFlowPages`, `offerSegments`. Piszą: `lib/strategy-hub/auto-relations.ts`, `app/api/.../funnel-board/route.ts`, `.../funnel-elements/[elementId]/relations` i `back-relations`, `.../offers/[offerId]/segments`. Czytają: `relation-graph.ts`, `strategy-map.ts`, `mcp/server.ts`. Wzorzec polimorficzny już istnieje: `decisionLinks`. |
| AI | `lib/strategy-hub/ai-tools.ts` (932 l.): `buildChatTools(projectId, tools)` — read/write/suggest + webSearch (Tavily) + readNotion. Chat: `app/api/strategy-hub/chat/route.ts` — `streamText`, modele claude-*-4-5, `maxSteps: 15`; **system prompt dziś ZAKAZUJE zmian bez potwierdzenia (linia 84)**. Agent: `lib/strategy-hub/agent/run-agent.ts` (4 tryby: audit/monitor/improve/research, zero direct write → `aiProposals`); `accept-proposal.ts` z hardcoded `TARGET_TABLES` (3 tabele). UI propozycji: `components/strategy-hub/agent-panel.tsx`. |
| Reguły/health | `lib/strategy-hub/rules/*` — maszyna stanów modułów (empty/in_progress/review/ready), locki upstream, propagacja `reviewFlag` (`apply-review.ts`); `health-score.ts`, `alerts.ts`. Nie czytają tabel join bezpośrednio. |
| Crony | `vercel.json`: `/api/strategy-hub/digest` (pon. 8:00), `/api/strategy-hub/notion/cron` (codz. 6:00). Guard `CRON_SECRET` — skopiuj wzorzec z digest. |
| Testy | `npm run test` = `tsx scripts/test-rules.ts`. E2E: Playwright (`e2e/`). |
| DB | Neon (`lib/strategy-hub/db-url.ts`) — pgvector dostępny. Drizzle 0.45 ma typ `vector()` w `drizzle-orm/pg-core`. |
| Portal klienta | `app/projects/[slug]/**` reużywa komponentów Hub z `mode="client"` + filtrowanie `lib/strategy-hub/visibility.ts`. |

## Decyzje architektoniczne (finalne — nie zmieniaj)

1. Mózg **per projekt**. 2. Relacje semantyczne w JEDNEJ tabelce `entity_relations`; relacje strukturalne (FK typu `funnelElements.stageId`, `kpis.segmentId`, `seoKeywords.targetPageId`) ZOSTAJĄ w tabelach typowanych i są derywowane do grafu przy odczycie. 3. Pełna autonomia AI + changelog z undo (bez bramki akceptacji). 4. Embeddingi: Voyage AI `voyage-3.5` (1024 wym.) + pgvector. 5. Widoki: konstelacja (SVG+Motion+d3-hierarchy) i pipeline; bez zmiany palety. 6. Portal klienta: konstelacja read-only. 7. Dane pre-produkcyjne — join-tabele seedujemy do grafu i DROPujemy bez ceregieli.

---

# FAZA A — Rdzeń grafu (rozmiar L)

## A1. Client-safe katalog typów encji

**Nowy plik `lib/strategy-hub/entities/entity-types.ts`** — BEZ `import "server-only"` (importują go komponenty klienckie i moduły serwerowe):

```ts
export type EntityTypeKey =
  | "segment" | "stage" | "element" | "channel" | "kpi" | "page"
  | "campaign" | "geo" | "offer" | "flow" | "competitor" | "objection"
  | "problem" | "decision" | "seo_keyword";

export type StrategyArea =
  | "fundament" | "segmenty" | "lejek" | "kanaly" | "przekaz" | "strona" | "kpi";

export interface EntityTypeMeta {
  label: string;          // l.poj. PL, np. "Segment"
  labelPlural: string;    // l.mn. PL
  color: string;          // 1:1 z dotychczasowego ENTITY_COLORS / COLOR
  area: StrategyArea;     // przypisanie do modułu makro-mapy
  registryKey: string | null; // klucz w registry.ts (l.mn., np. "segments"); null gdy encja nie ma CRUD w rejestrze (np. "stage")
  href: (projectId: string, entityId?: string) => string; // przenieś logikę href z relation-graph.ts
}

export const ENTITY_TYPE_META: Record<EntityTypeKey, EntityTypeMeta> = { /* ... */ };

export const RELATION_TYPES = {
  publikowany_w:   { label: "publikowany w" },
  mierzony_przez:  { label: "mierzony przez" },
  promowany_przez: { label: "promowany przez" },
  wspierany_przez: { label: "cytowalny w AI przez" },
  prowadzi_przez:  { label: "prowadzi przez" },
  skierowana_do:   { label: "dla segmentu" },
  targetuje:       { label: "targetuje" },
  laduje_na:       { label: "ląduje na" },
  adresuje:        { label: "adresuje" },
  oslabia:         { label: "osłabia" },
  wspiera:         { label: "wspiera" },
  konkuruje_z:     { label: "konkuruje z" },
  powiazany_z:     { label: "powiązany z" },
} as const;
export type RelationTypeKey = keyof typeof RELATION_TYPES;
```

Etykiety relacji MUSZĄ pokrywać się z dzisiejszymi etykietami krawędzi w `relation-graph.ts` (parytet wizualny). Mapowanie kolorów przenieś 1:1 z `ENTITY_COLORS` (`lib/strategy-hub/strategy-map-types.ts`) i `COLOR` (`relation-graph.ts`).

**Deduplikacja (modyfikacje):**
- `strategy-map-types.ts`: `ENTITY_COLORS`/`ENTITY_LABELS` stają się re-eksportami wyliczonymi z `ENTITY_TYPE_META` (zachowaj identyczne wartości i nazwy eksportów — importerzy bez zmian).
- `relation-graph.ts`: usuń lokalny `COLOR`, użyj katalogu.
- `track-change.ts`: usuń `ENTITY_TYPE_MAP`; `entityTypeFor(entityKey)` implementuj odwrotnym lookupem po `ENTITY_TYPE_META[*].registryKey`, fallback jak dziś (`?? entityKey`). UWAGA: mapa zawiera dziś klucze spoza katalogu (sites, sales-pitches, sales-scripts, lead-magnets, geo-queries) — dodaj te typy do katalogu ALBO zostaw dla nich mały lokalny fallback-słownik; nie zgub żadnego mapowania.

## A2. Tabela `entity_relations`

**`db/schema.ts`** — dopisz:

```ts
export const entityRelations = pgTable("entity_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").references(() => strategyPaths.id, { onDelete: "set null" }),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceId: uuid("source_id").notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: uuid("target_id").notNull(),
  relationType: varchar("relation_type", { length: 50 }).notNull(),
  strength: real("strength"),            // 0..1, null = nieokreślona
  rationaleMd: text("rationale_md"),
  source: varchar("source", { length: 10 }).notNull().default("human"), // 'human' | 'ai'
  confidence: real("confidence"),        // tylko dla source='ai'
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});
```

**Migracja `db/migrations/0021_entity_relations.sql`** — CREATE TABLE jw. + indeksy:
`(project_id)`, `(source_type, source_id)`, `(target_type, target_id)` oraz
`CREATE UNIQUE INDEX entity_relations_uniq ON entity_relations (project_id, source_type, source_id, target_type, target_id, relation_type) WHERE deleted_at IS NULL;`

Kierunkowość: krawędź czytamy „source —(relationType)→ target" zgodnie z etykietami (element →`publikowany_w`→ channel itd.). Traversal (getNeighbors) chodzi w OBU kierunkach.

## A3. Store + API relacji

**Nowy `lib/strategy-hub/relations/schemas.ts`** (bez server-only — używany też w kliencie):

```ts
export const entityRefSchema = z.object({
  type: z.string().refine(t => t in ENTITY_TYPE_META),
  id: z.string().uuid(),
});
export const relationCreateSchema = z.object({
  source: entityRefSchema,
  target: entityRefSchema,
  relationType: z.string().min(1).max(50), // klucz z RELATION_TYPES lub custom
  strength: z.number().min(0).max(1).nullable().optional(),
  rationaleMd: z.string().max(4000).nullable().optional(),
  pathId: z.string().uuid().nullable().optional(),
});
export const relationPatchSchema = relationCreateSchema
  .pick({ relationType: true, strength: true, rationaleMd: true }).partial();
```

**Nowy `lib/strategy-hub/relations/store.ts`** (server-only). Sygnatury:

```ts
interface EntityRef { type: EntityTypeKey; id: string }
listRelations(projectId, filters?: { type?: string; source?: "human"|"ai"; entity?: EntityRef }): Promise<RelationRow[]>
createRelation(projectId, data: RelationCreate, opts: { source: "human"|"ai"; confidence?: number; userId?: string|null; batchId?: string }): Promise<RelationRow>
updateRelation(projectId, relationId, patch, opts): Promise<RelationRow | undefined>
softDeleteRelation(projectId, relationId, opts): Promise<boolean>
getNeighbors(projectId, ref: EntityRef, depth?: 1|2): Promise<{ nodes: EntityRef[]; relations: RelationRow[] }>
findPath(projectId, a: EntityRef, b: EntityRef, maxDepth?: number /* default 4 */): Promise<RelationRow[] | null>  // BFS w aplikacji
getSubgraph(projectId, scope: { area?: StrategyArea; refs?: EntityRef[] }): Promise<{ relations: RelationRow[] }>
```

Wymagania:
- `createRelation`: walidacja typów przeciw katalogowi + duplikatu (SELECT po kluczu unikalnym; jeśli istnieje aktywna — zwróć istniejącą, nie duplikuj); zakaz self-loop (source==target); NIE weryfikuj istnienia rekordu docelowego synchronicznie w DB (koszt) — sierotami zajmie się cron (C3).
- KAŻDY zapis → `await trackChange({ projectId, entityType: "relation", entityId: relationId, patch, source, userId })` — dzięki temu SSE odświeża UI bez dodatkowej pracy.
- BFS: najpierw jeden SELECT wszystkich aktywnych relacji projektu (graf ≤ kilkuset krawędzi), potem przeszukiwanie w pamięci (mapa adjacency w obu kierunkach).

**Nowe route'y** (wzorzec walidacji/auth z istniejących):
- `app/api/strategy-hub/projects/[id]/relations/route.ts` — GET (filtry z query: `?entityType=&entityId=&source=`), POST (relationCreateSchema, `source:'human'`, userId z sesji).
- `app/api/strategy-hub/projects/[id]/relations/[relationId]/route.ts` — PATCH, DELETE (soft).

## A4. Seed, przełączenie odczytów/zapisów, DROP

**Nowy `scripts/seed-entity-relations.ts`** (uruchamianie: `npx tsx --env-file=.env.local scripts/seed-entity-relations.ts`; wzorzec: `scripts/seed-rules.ts`). Mapowanie join → relacja:

| Tabela join | source | target | relationType |
|---|---|---|---|
| funnelElementChannels | element | channel | publikowany_w |
| funnelElementKpis | element | kpi | mierzony_przez |
| funnelElementCampaigns | element | campaign | promowany_przez |
| funnelElementGeo | element | geo | wspierany_przez |
| userFlowPages | flow | page | prowadzi_przez |
| offerSegments | offer | segment | skierowana_do |

`projectId` wyprowadź joinami (element→stage→segment→projectId itd. — wzory w `relation-graph.ts`). Idempotencja: NIE używaj `onConflict` na częściowym indeksie unikalnym (Drizzle tego nie wspiera wprost) — zamiast tego SELECT istniejących kluczy do `Set` i insert tylko brakujących. `source: 'human'`.

**Przełączenie (modyfikacje):**
1. `lib/strategy-hub/relation-graph.ts` — węzły jak dziś (tabele typowane); krawędzie = (a) derywowane z FK jak dziś (segment→stage, stage→element, campaign.segmentId itd.) + (b) `entity_relations` zamiast 4 join-tabel. **Kształt `RelationGraphData` bez zmian** — `relation-graph.tsx` i zapis layoutu działają dalej. Etykiety krawędzi z `RELATION_TYPES[..].label`.
2. `lib/strategy-hub/strategy-map.ts` (graf wpływu) — analogicznie.
3. `lib/strategy-hub/auto-relations.ts` — sekcja zapisu sugestii: insert do `entity_relations` przez `createRelation(...)` z `source:'ai'`; usuń inserty do join-tabel. Heurystyki (segment+faza) bez zmian.
4. Route'y zapisu relacji lejka: `funnel-board/route.ts`, `funnel-elements/[elementId]/relations/route.ts`, `.../back-relations/route.ts`, `offers/[offerId]/segments/route.ts` — przepisz na store (zachowaj kontrakty odpowiedzi, żeby UI nie wymagało zmian; jeśli kontrakt zwraca kształt join-tabeli, zmapuj z RelationRow).
5. `lib/strategy-hub/mcp/server.ts` — odczyty relacji na store.
6. **Dopiero po zielonej bramce A**: migracja `0022_drop_join_tables.sql` (`DROP TABLE` 6 tabel) + usunięcie ich definicji i WSZYSTKICH importów z `db/schema.ts` i kodu (grep: `funnelElementChannels|funnelElementKpis|funnelElementCampaigns|funnelElementGeo|userFlowPages|offerSegments`).

**ADR:** `docs/adr/0006-uniwersalny-graf-relacji.md` (decyzja: semantyka w grafie, struktura w FK; brak FK na kolumnach polimorficznych — Zod + cron sierot).

## Bramka A

1. `npm run typecheck && npm run lint && npm run build` — zielone.
2. **Nowy `scripts/test-relations.ts`** (wzorzec `test-rules.ts`; dopisz do skryptu `test` w package.json: `tsx scripts/test-rules.ts && tsx scripts/test-relations.ts`). Testy (na DB z `--env-file=.env.local`, na projekcie testowym tworzonym i sprzątanym w skrypcie): create/duplicate-guard/self-loop-guard/patch/softDelete; getNeighbors depth 1 i 2 w obu kierunkach; findPath istniejąca i nieistniejąca ścieżka; parytet: liczba i etykiety krawędzi `getRelationGraphData` PRZED przełączeniem == PO (uruchom seed na projekcie testowym z danymi w join-tabelach zanim je zdropujesz).
3. Ręcznie: `/strategy-hub/projects/[id]` → graf relacji i widok wpływu wyglądają jak przed zmianą; drag węzła zapisuje layout.

---

# FAZA B — Embeddingi + pgvector (rozmiar M)

## B1. Migracja `0023_pgvector_embeddings.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE entity_embeddings (
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_hash varchar(64) NOT NULL,
  embedding vector(1024) NOT NULL,
  model varchar(50) NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX entity_embeddings_project_idx ON entity_embeddings (project_id);
CREATE INDEX entity_embeddings_hnsw ON entity_embeddings USING hnsw (embedding vector_cosine_ops);
```

W `db/schema.ts`: `vector("embedding", { dimensions: 1024 })` z `drizzle-orm/pg-core`.

## B2. Provider + indeksacja

**`lib/strategy-hub/embeddings/provider.ts`** (server-only):
- POST `https://api.voyageai.com/v1/embeddings`, nagłówek `Authorization: Bearer ${process.env.VOYAGE_API_KEY}`, body `{ model: "voyage-3.5", input: string[], input_type: "document" | "query" }`.
- `AbortSignal.timeout(10_000)`, batch ≤ 128 tekstów, każdy tekst przycięty do 8000 znaków, odpowiedź walidowana Zod (`{ data: [{ embedding: number[] }] }` + sprawdzenie długości 1024).
- Brak `VOYAGE_API_KEY` → funkcje zwracają `null` i logują raz ostrzeżenie (aplikacja działa bez embeddingów — degradacja, nie crash).

**`lib/strategy-hub/embeddings/content.ts`**:
- `buildEmbeddingText(entityType, row): string | null` — konkatenacja pól tekstowych wg mapy per typ (np. segment: name+personaName+jtbdMd+problemMd+uvpForSegmentMd; objection: objectionMd+responseMd; page: name+urlPath+goal; ...). NIE indeksuj: `credentials`, pól technicznych, encji spoza katalogu.
- `contentHash = sha256(text)` (node:crypto).

**`lib/strategy-hub/embeddings/indexer.ts`**:
- `reindexEntity(projectId, entityType, entityId)` — pobierz wiersz przez rejestr, zbuduj tekst; hash == istniejący → skip; inaczej embed + upsert (`onConflictDoUpdate` po PK — tu zwykły PK, wolno).
- `reconcileProject(projectId, { cap = 200 })` — przejdź typy z katalogu z `registryKey`, indeksuj brakujące/przeterminowane po hashu, max `cap` wywołań embed na przebieg; zwróć `{ indexed, skipped }`.

**Trigger na zapisie** — w `track-change.ts` na końcu `trackChange` (po udanym insercie):

```ts
import { after } from "next/server";
// … w trackChange:
after(() => reindexEntity(projectId, entityType, entityId).catch(() => {}));
```

UWAGA: `after()` działa w route handlers/server actions; `trackChange` bywa też wołany ze skryptów CLI — opakuj w `try/catch` i fallback na zwykły `void promise` gdy `after` rzuci (poza request scope). Nie indeksuj `entityType === "relation"`.

**Cron `app/api/strategy-hub/embeddings/cron/route.ts`**: guard `CRON_SECRET` (wzorzec z digest), iteracja po aktywnych projektach z kursorem (zapamiętaj offset w tabeli/kolumnie albo przejdź wszystkie z małym cap), `maxDuration = 300`. Wpis do `vercel.json`: `{"path": "/api/strategy-hub/embeddings/cron", "schedule": "0 4 * * *"}`.

## B3. Wyszukiwanie semantyczne

**`lib/strategy-hub/embeddings/search.ts`**: `searchSimilar(projectId, opts: { query?: string; entityRef?: EntityRef; k?: number /* default 8 */ })` — embedding zapytania (`input_type:"query"`) lub wektor encji z tabeli; SQL: `SELECT entity_type, entity_id, 1 - (embedding <=> ${vec}) AS similarity ... WHERE project_id = ... ORDER BY embedding <=> ${vec} LIMIT k` (drizzle `sql` template; wektor jako `'[0.1,0.2,...]'::vector`). Dołącz meta z katalogu (label/color/href).

**Endpoint `app/api/strategy-hub/projects/[id]/semantic-search/route.ts`** — POST `{ query?, entityRef?, k? }` (Zod, wymagany dokładnie jeden z query/entityRef).

## Bramka B

1. typecheck/lint/build zielone.
2. Rozszerz `scripts/test-relations.ts` LUB nowy `scripts/test-embeddings.ts` (dopisz do `test`): `buildEmbeddingText` zwraca poprawny tekst i pomija credentials; hash-skip (drugi reindex tej samej encji = 0 wywołań providera — mock provider przez wstrzyknięcie/env `VOYAGE_API_KEY` brak → null-path też przetestuj).
3. Ręcznie (wymaga klucza): `reconcileProject` na projekcie testowym; drugi przebieg → `indexed: 0`; semantic-search po polsku zwraca sensownych sąsiadów.

---

# FAZA C — Autonomia AI: bezpośredni zapis + UNDO + tło (rozmiar L)

## C1. Undo w change_history

**Migracja `0024_change_history_undo.sql`**:

```sql
ALTER TABLE change_history
  ADD COLUMN batch_id uuid,
  ADD COLUMN before_json jsonb,
  ADD COLUMN undone_at timestamp;
CREATE INDEX change_history_batch_idx ON change_history (project_id, batch_id);
```

**KRYTYCZNE — dlaczego `before_json`:** istniejące `oldValue` to serializowany TEKST (JSON.stringify/String) — nie da się z niego bezpiecznie odtworzyć typów (liczby, boole, JSONB, daty) do odwrotnego patcha. `before_json` przechowuje surową wartość pola jako jsonb (`{"value": <raw>}` albo bezpośrednio wartość — wybierz `{"value": ...}` dla odróżnienia `null` od braku).

**`track-change.ts`** — rozszerz sygnaturę:

```ts
trackChange(params: {
  ...jak dziś,
  before?: Record<string, unknown>; // wartości pól PRZED zmianą (tylko zmieniane pola)
  batchId?: string;
})
```

- `oldValue: serializeValue(before?.[field]) ?? null` (dla czytelności w UI historii) + `beforeJson: before ? { value: before[field] ?? null } : null` + `batchId`.
- Wypełnianie `before` w ścieżkach zapisu: dynamiczny route `app/api/strategy-hub/projects/[id]/[entity]/[itemId]/route.ts` (i pokrewne) — przed `registry.update` pobierz bieżący wiersz (`list()` + find po id LUB dodaj do rejestru `get(projectId, itemId)` — dodaj `get` do `ListEntityDef`, implementacja = select po id, to ~25 mechanicznych dopisków wg jednego wzorca) i przekaż `before` zawężone do kluczy patcha.

**Rejestr — `restore`**: dodaj do `ListEntityDef` metodę `restore(projectId: string, itemId: string): Promise<boolean>` (UPDATE `deleted_at = NULL`). Mechaniczne uzupełnienie we wszystkich definicjach (wzorzec identyczny jak `softDelete`).

**Nowy `lib/strategy-hub/undo.ts`**:

```ts
undoBatch(projectId: string, batchId: string, userId: string | null): Promise<{ undone: number }>
```

Algorytm: pobierz wpisy batcha (`undone_at IS NULL`), pogrupuj po (entityType, entityId), w kolejności odwrotnej do createdAt:
- wpis z `field === "__created"` → `softDelete` encji;
- wpis z `field === "__deleted"` → `restore`;
- zwykłe pola → zbuduj patch `{ [field]: beforeJson.value }`, ZWALIDUJ przez `patchSchema` rejestru (`safeParse`; pola nieprzechodzące walidacji pomiń i zalicz do `skipped`), zastosuj przez `registry.update`;
- relacje (`entityType === "relation"`): `__created` → `softDeleteRelation`, `__deleted` → restore relacji (update `deletedAt: null`), pola → `updateRelation`.
Na koniec oznacz wpisy `undone_at = now()` i zapisz NOWY wpis historii `source: "undo"`. Konflikt (encja zmieniona później przez kogoś innego): świadomie last-write-wins — undo nadpisuje; to akceptowalne przy zespole 1–2 os.

Żeby `__created`/`__deleted` istniały: w ścieżkach create/delete wołaj `trackChange` z patch `{ __created: true }` / `{ __deleted: true }` (sprawdź, czy create/delete już dziś trackują — jeśli tak, dostosuj konwencję zamiast dublować).

**Endpoint:** `app/api/strategy-hub/projects/[id]/changes/[batchId]/undo/route.ts` (POST, auth editor).

## C2. Generyczne narzędzia zapisu AI (registry-driven)

**Nowy `lib/strategy-hub/ai-tools-write.ts`** (server-only) — fabryka:

```ts
buildWriteTools(projectId: string, opts: { batchId: string; source: "ai"; userId: string | null })
```

Narzędzia (`tool()` z pakietu `ai`, wzorzec z `ai-tools.ts`):
- `create_entity` — params: `{ entityKey: z.enum([...listEntityKeys()]), data: z.record(z.unknown()) }`; wykonanie: `registry.createSchema.safeParse(data)` → błąd walidacji ZWRACAJ jako wynik narzędzia (model się poprawi), sukces → `create` + `trackChange({ batchId, source:'ai', patch:{ __created:true, ...data } })`.
- `update_entity` — `{ entityKey, itemId, data }` → patchSchema → `get` (before) → `update` + trackChange z before/batchId.
- `delete_entity` — `{ entityKey, itemId }` → softDelete + trackChange `__deleted`.
- `create_relation` / `update_relation` / `delete_relation` — na store z A3; `rationaleMd` WYMAGANE przy create (min 10 znaków); `source:'ai'` + `confidence` (param 0–1 wymagany).
- Singletony: `update_singleton` — `{ entityKey: z.enum([...singletonEntityKeys()]), data }` → upsert.

`batchId`: generowany raz per żądanie czatu / przebieg agenta (`crypto.randomUUID()`), przekazywany JAWNIE przez parametry fabryki (nie AsyncLocalStorage).

**Modyfikacje:**
- `app/api/strategy-hub/chat/route.ts`: dołącz `...buildWriteTools(projectId, { batchId, source:'ai', userId })` do `chatTools`; **PRZEPISZ system prompt** — usuń zakaz „Nie zmieniaj danych bez potwierdzenia"; nowe zasady: „Masz pełne uprawnienia edycji strategii. Zmiany wykonuj od razu, gdy intencja użytkownika jest jasna; przy zmianach szerokich (>5 encji) najpierw wypisz plan. Każda zmiana jest odwracalna (undo). Po zmianach podsumuj co zmieniłeś i dlaczego."; w odpowiedzi (nagłówek/`data` streamu) zwróć `batchId`, żeby UI czatu mogło pokazać „Cofnij".
- `lib/strategy-hub/agent/run-agent.ts`: tryby audit/monitor/improve/research zostają; zamiast pisać do `aiProposals` jako `pending` — wykonują zmiany narzędziami zapisu i logują wynik do `aiProposals` ze statusem `applied` (kolumny diff/rationaleMd jak dziś + zapisz `batchId` w `sources` lub dodaj kolumnę `batch_id` w tej samej migracji 0024). Zmiany TREŚCI encji przez agenta w tle: zawsze ustaw `reviewFlag: true` na encji (istniejąca propagacja w `rules/apply-review.ts` podświetli w UI). Relacje: bez reviewFlag.
- **USUŃ**: `lib/strategy-hub/agent/accept-proposal.ts`, endpointy accept/reject (znajdź po grepie `accept-proposal|acceptProposal`), wywołania w `mcp/server.ts` (narzędzia accept_proposal/reject_proposal → usuń lub przerób na `undo_batch`).
- `components/strategy-hub/agent-panel.tsx`: przerób z kolejki akceptacji na **feed aktywności AI**: lista wpisów `aiProposals(applied)` + grupy `change_history` po `batch_id` (source='ai'), każdy z przyciskiem „Cofnij" → POST undo. Nazwa pliku zostaje (mniejszy diff).

## C3. Cron agenta w tle

**Nowy `app/api/strategy-hub/agent/cron/route.ts`** (+ vercel.json `{"path": "/api/strategy-hub/agent/cron", "schedule": "0 5 * * *"}`; guard `CRON_SECRET`; `maxDuration = 300`):
Kolejno per projekt (round-robin, cap czasu ~240 s, kursor po `projects.updatedAt` lub id):
1. **Sieroty**: relacje, których source/target nie istnieje lub ma `deletedAt` → softDelete relacji (wpis w historii `source:'ai'`).
2. **Auto-relacje**: heurystyki z `auto-relations.ts` + semantyka: dla encji bez relacji wyjściowych `searchSimilar(entityRef, k=5)`; similarity ≥ 0.75 → `create_relation` z `relationType:'powiazany_z'`, `confidence = similarity`, rationale z uzasadnieniem; poniżej progu → nic (nie spamuj feedu).
3. **Spójność/luki**: `runAgentMode('monitor')` i `runAgentMode('audit')` z nowym toolsetem.
4. **Health snapshot**: reuse `health-score.ts` (jeśli digest już snapshotuje — pomiń tu).

**ADR:** `docs/adr/0008-autonomia-ai-changelog-undo.md` (decyzje: before_json vs oldValue, last-write-wins przy undo, reviewFlag jako bezpiecznik, progi confidence).

## Bramka C

1. typecheck/lint/build zielone; `npm run test` zielone.
2. **Nowy `scripts/test-undo.ts`** (dopisz do `test`): roundtrip na projekcie testowym — (a) update encji → undoBatch → wartości pól == sprzed; (b) create → undo → soft-deleted; (c) delete → undo → przywrócona; (d) relacja create → undo → soft-deleted; (e) batch mieszany 3 encje → wszystkie cofnięte; (f) drugi undo tego samego batcha → `{ undone: 0 }`.
3. Ręcznie: czat „dodaj KPI X i połącz z segmentem Y" → encja + relacja powstają, feed pokazuje wpis z „Cofnij", undo działa, SSE odświeża graf. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/strategy-hub/agent/cron` przechodzi.

---

# FAZA D — Widok KONSTELACJI (rozmiar L)

Technologia: **własny SVG + Motion + d3-hierarchy** (NIE React Flow). Nowa zależność: `npm i d3-hierarchy && npm i -D @types/d3-hierarchy`.

## D1. Read-model

**Nowy `lib/strategy-hub/constellation-data.ts`** (server-only) + **endpoint GET `app/api/strategy-hub/projects/[id]/constellation/route.ts`**. Kształt danych (eksportuj typy z pliku client-safe, np. `constellation-types.ts`):

```ts
export interface ConstellationNode {
  id: string;                 // "type:uuid" albo "area:kanaly" albo "core"
  kind: "core" | "area" | "entity";
  entityType?: EntityTypeKey;
  label: string;
  color: string;              // z ENTITY_TYPE_META / koloru modułu
  status?: "ready" | "in_progress" | "empty" | "review"; // area: z rules/resolve.ts
  score?: number;             // area: 0-100
  href?: string;              // deep-link do edytora
  parentId: string | null;    // core→null, area→"core", entity→"area:X"
  childCount?: number;        // dla agregacji "+N więcej"
}
export interface ConstellationLink {
  id: string;
  sourceId: string; targetId: string;   // id węzłów jw.
  kind: "tree" | "cross";               // tree = hierarchia, cross = relacja semantyczna z entity_relations
  relationLabel?: string;               // dla cross
  aiGenerated?: boolean;                // source === 'ai' → inny styl kreski
}
export interface ConstellationData {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  areasOrder: StrategyArea[];           // = presentationOrder ze strategy-map-types.ts
  health: number;
}
```

Budowa: core (projekt: name + health z `health-score.ts`) → 7 obszarów (statusy z `rules/resolve.ts` — reuse funkcji, którymi karmi się `map-view.tsx`) → encje (selecty jak w `relation-graph.ts`, przypisanie do obszaru po `ENTITY_TYPE_META.area`). Cross-linki: wszystkie aktywne `entity_relations` (id węzłów `"{type}:{id}"`). Limit: gdy obszar ma > 40 encji, zwróć 40 najważniejszych (priority/updatedAt) + `childCount` z nadwyżką.

## D2. Komponenty `components/strategy-hub/constellation/`

- **`radial-layout.ts`** (czysta funkcja, testowalna bez DOM): d3-hierarchy `tree().size([2 * Math.PI, radius])` na drzewie core→area→entity; projekcja polarna `x = cx + r * Math.cos(angle - π/2)`, `y = cy + r * Math.sin(angle - π/2)`; promienie: core r=0, area r=220, entity r=420+ (kolejne pierścienie gdy dużo encji). Zwraca `Map<nodeId, {x, y, angle}>`.
- **`constellation-view.tsx`** — `"use client"`; ładowany WYŁĄCZNIE przez `next/dynamic(..., { ssr: false })`. Props: `{ projectId, mode: "editor" | "client", initialFocus?: string /* z ?focus= */ }`. Renderuje jeden `<svg>` z `<g transform={camera}>`: krawędzie (łuki quadratic bezier przez punkt przesunięty do centrum — wzorzec łuków z `map-view.tsx`), potem węzły. Cross-linki: kropkowane, widoczne od zoomu ≥ 0.7 albo gdy węzeł fokusowany (LOD). Etykiety: area zawsze; entity od zoomu ≥ 0.9 lub przy fokusie.
- **`constellation-node.tsx`** — `<g>` z okręgiem (fill = color, glow przez svg filter TYLKO na fokusie), status ring dla area (kolor statusu), `tabIndex` sterowany rovingiem, `role="button"`, `aria-label`.
- **`use-camera.ts`** — stan `{ x, y, scale }`; pan (pointer drag), zoom (wheel, pinch), `focusNode(id)` — spring animacja Motion (`useSpring`/`animate`) TYLKO transform; `useReducedMotion()` → przejścia natychmiastowe.
- **`area-navigator.tsx`** — strzałki ‹ › na dole (jak ref. alassafi): przeskok kamerą między obszarami wg `areasOrder`. Klawiatura (handler na kontenerze): ←/→ obszar, ↑/↓ następna/poprzednia encja w obszarze, Enter → panel encji, Esc → zoom-out do total view. `aria-live="polite"` ogłasza fokusowany węzeł.
- **`entity-panel.tsx`** — boczny panel (prawa strona, overlay): label, typ, status, relacje wchodzące/wychodzące (z linków), przyciski: „Otwórz w edytorze" (href; tylko mode=editor), „Pokaż decyzje" (reuse istniejącego `decision-overlay`), „Dodaj relację" (mode=editor: combobox encji docelowej + typ relacji → POST /relations).
- Ciemne tło: scope'owane na kontener widoku (np. `bg-[oklch(0.13_0.02_260)]` klasa lokalna) — NIE zmieniaj globalnych zmiennych motywu.

## D3. Integracja

- `strategy-map.tsx`: czwarty tryb switchera „Konstelacja" (lazy import). W `mode="client"` konstelacja jest DOMYŚLNA, edycja ukryta, encje filtrowane przez `visibility.ts` (filtruj w read-modelu — parametr `mode` w `constellation-data.ts`).
- Deep-link: czytaj `?focus=type:id` (nuqs/searchParams — wzorzec z repo) → `initialFocus`.
- Portal klienta `app/projects/[slug]/strategy`: renderuj konstelację w mode=client (sprawdź jak portal montuje `strategy-map` i podepnij analogicznie).

**ADR:** `docs/adr/0009-konstelacja-svg-motion.md`.

## Bramka D

1. typecheck/lint/build; bundle: `npm run analyze` — route strategy-map < 200 KB initial JS (konstelacja w osobnym chunku).
2. **Nowy test w `scripts/test-relations.ts` lub osobny**: `radial-layout` — dla syntetycznego drzewa (7 obszarów × 10 encji) zwraca unikalne pozycje, wszystkie w promieniu, kąty obszarów rosnące wg `areasOrder`.
3. **E2E Playwright `e2e/constellation.spec.ts`**: login → projekt → widok Konstelacja renderuje ≥ 8 węzłów (core+7 area); klik encji otwiera panel; klawiatura → fokus się przemieszcza (sprawdź `aria-live`); mode=client (portal): brak przycisków edycji.
4. Reduced-motion: emulacja w Playwright (`page.emulateMedia({ reducedMotion: "reduce" })`) — brak animacji spring (kamera skacze natychmiast).

---

# FAZA E — Widok PIPELINE (rozmiar M)

**Nowy `lib/strategy-hub/pipeline.ts`** (server-only) + GET `app/api/strategy-hub/projects/[id]/pipeline/route.ts`:

```ts
export interface PipelineStage {
  key: "brief" | "research" | StrategyArea;   // kolejność: brief, research, fundament, segmenty, lejek, kanaly, przekaz, strona, kpi
  label: string;
  status: "empty" | "in_progress" | "review" | "ready" | "locked"; // z rules/resolve.ts; locked gdy upstream pusty
  score: number;
  aiActions: { at: string; summary: string; batchId: string | null }[]; // ostatnie ≤5 z change_history source='ai' + aiProposals(applied) per moduł
  humanGates: { label: string; href: string }[]; // otwarte projectQuestions + encje z reviewFlag + locki (CTA przez area-routes.ts)
}
```

`brief` = status onboardingu/discovery (sprawdź w rejestrze moduł discovery/`projectQuestions`); `research` = aktywność agenta research (wpisy `aiProposals` mode='research').

**Komponenty `components/strategy-hub/pipeline/`**: `pipeline-view.tsx` (poziomy stepper; reuse `status-dot.tsx` jeśli istnieje — sprawdź; segmenty połączone linią, aktywny etap rozwinięty) + `pipeline-stage.tsx` (karta: status, score, lista akcji AI, lista bramek ludzkich z CTA). Piąty tryb w switcherze `strategy-map.tsx` (lazy).

## Bramka E

1. typecheck/lint/build.
2. E2E: widok Pipeline renderuje 9 etapów; etap z pustym upstream pokazuje „locked"; CTA bramki prowadzi do edytora modułu.

---

# FAZA F — Czat AI nawiguje grafem (rozmiar M)

**Nowy `lib/strategy-hub/ai-tools-graph.ts`** — read-toolset (wzorzec `tool()` z `ai-tools.ts`):
- `get_neighbors` `{ entityType, entityId, depth: 1|2 }` → store.getNeighbors, wynik z labelami z katalogu.
- `find_path` `{ from: {type,id}, to: {type,id} }` → store.findPath, opis ścieżki tekstem („Segment X → [targetuje] → Kampania Y…").
- `get_subgraph` `{ area? , refs? }`.
- `semantic_search` `{ query, k }` → search z B3.
- `focus_map_node` `{ entityType, entityId, mode: "focus"|"highlight"|"path", pathIds?: string[] }` — narzędzie UI: NIC nie zapisuje, zwraca `{ ok: true }`; jego wywołanie jest sygnałem dla frontendu.

**Modyfikacje:**
- Chat route: dołącz toolset; w system promptcie dopisz: „Nawigując po strategii używaj get_neighbors/find_path; gdy omawiasz konkretny element, wywołaj focus_map_node, żeby pokazać go na mapie."
- **Nowy `lib/strategy-hub/map-focus-bus.ts`** (client, ~20 linii): `emitMapFocus(detail)` → `window.dispatchEvent(new CustomEvent("hub:map-focus", { detail }))`; `onMapFocus(cb)` → addEventListener + cleanup.
- Komponent czatu (znajdź: `chat-panel.tsx`): w renderze tool-invocations — gdy przyjdzie `focus_map_node`, wywołaj `emitMapFocus`; jeżeli konstelacja niezamontowana (brak nasłuchu — flaga w busie), pokaż link „Pokaż na mapie" → `/strategy-hub/projects/[id]/strategy-map?view=constellation&focus=type:id`.
- `constellation-view.tsx`: subskrypcja `onMapFocus` → `focusNode` / highlight ścieżki (podświetl kolejne krawędzie z `pathIds`).

## Bramka F

1. typecheck/lint/build; pełne `npm run test`.
2. E2E: otwórz strategy-map (konstelacja) + czat; zapytaj „pokaż segment X na mapie" → kamera dojeżdża do węzła (assert transform się zmienił / węzeł ma klasę fokusa). Deep-link `?focus=` fokusuje po załadowaniu.

---

# Zbiorczo

**Usuwamy:** 6 tabel join (+ DROP migracja, koniec A) · `agent/accept-proposal.ts` + endpointy/UI accept-reject (C) · duplikaty map kolorów/typów (A).
**Nowe zależności:** `d3-hierarchy`, `@types/d3-hierarchy`.
**Nowe ENV:** `VOYAGE_API_KEY` (opcjonalny — degradacja bez embeddingów), `CRON_SECRET` (jest już przy digest — zweryfikuj).
**Nowe wpisy vercel.json:** embeddings cron (4:00), agent cron (5:00).
**ADR-y:** 0006 graf relacji, 0007 embeddingi Voyage+pgvector, 0008 autonomia+undo, 0009 konstelacja SVG.
**Skrypt `test` w package.json po całości:** `tsx scripts/test-rules.ts && tsx scripts/test-relations.ts && tsx scripts/test-undo.ts` (+ ewentualnie test-embeddings).

**Weryfikacja końcowa (po F):** `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e`; ręczny scenariusz demo: nowy projekt → onboarding → czat AI buduje fundament+segmenty (widać w pipeline) → konstelacja pokazuje rosnący organizm → agent cron dodaje relacje `powiazany_z` → undo jednej zmiany AI → health score bez regresji względem stanu sprzed refaktoru.
