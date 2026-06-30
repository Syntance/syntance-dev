# 02 — Model danych 2.0

Wszystkie nowe tabele idą do [db/schema.ts](db/schema.ts), zachowując konwencje repo:

- `id: uuid("id").primaryKey().defaultRandom()`
- FK `projectId` z `references(() => projects.id, { onDelete: "cascade" })`
- soft-delete: `deletedAt: timestamp("deleted_at")` (filtrowane `isNull(...)` w registry)
- `pathId` (nullable, `onDelete: "set null"`) dla encji wspierających ścieżki strategii
- indeks `…_project_idx` na `projectId`
- timestamps `createdAt`/`updatedAt` jak w istniejących tabelach (`defaultNow().notNull()`)

Migracja: `db/migrations/0010_strategy_hub_2.sql` generowana przez `pnpm drizzle:generate` po edycji schematu. **Zasada bezpieczeństwa:** każda kolumna dodawana do istniejących tabel jest nullable lub ma default — istniejące dane (RetroHouse, Lumine) nie mogą się zepsuć.

Każdą nową encję listową rejestrujemy w [lib/strategy-hub/entities/registry.ts](lib/strategy-hub/entities/registry.ts) (wzorzec `listDef`/`singletonDef`) — wtedy automatycznie dostaje CRUD przez dynamiczny route `app/api/strategy-hub/projects/[id]/[entity]`. Nie tworzymy dedykowanych route'ów, chyba że potrzebny custom (np. relacje grafu).

## 1. Multi-site — `sites` + `siteId`

Projekt może mieć N stron WWW. Podstrony, nawigacja, SEO, GEO i audyty wiszą pod konkretną stroną.

```ts
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    type: varchar("type", { length: 100 }), // main | landing | microsite | shop
    status: varchar("status", { length: 50 }).default("active"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("sites_project_idx").on(t.projectId)]
);
```

Dodanie `siteId` (nullable, `onDelete: "set null"`) do: `pages`, `navItems`, `seoKeywords`, `siteAudits`.

**Migracja danych (krytyczna):** dla każdego istniejącego projektu utworzyć 1 rekord `sites` z `isPrimary = true` (`name` = nazwa projektu, `domain` z `projects.domain` jeśli jest) i przypisać `siteId` wszystkim istniejącym `pages`/`navItems`/`seoKeywords`/`siteAudits`. Realizować w migracji SQL (UPDATE … FROM) lub w [prisma/seed.ts](prisma/seed.ts)/skrypcie idempotentnym. ADR: „multi-site przez nullable siteId z domyślnym primary site".

## 2. Rejestr decyzji — `strategicDecisions` + `decisionLinks`

```ts
export const strategicDecisions = pgTable(
  "strategic_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    pathId: uuid("path_id").references(() => strategyPaths.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    reasonMd: text("reason_md"),        // przyczyna
    evidenceMd: text("evidence_md"),    // dowód / research / źródło
    status: varchar("status", { length: 20 }).default("active"), // active | revised | withdrawn
    authorType: varchar("author_type", { length: 10 }).default("human"), // human | ai
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("strategic_decisions_project_idx").on(t.projectId)]
);

export const decisionLinks = pgTable(
  "decision_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionId: uuid("decision_id").notNull().references(() => strategicDecisions.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // segment | objection | page | campaign | …
    entityId: uuid("entity_id").notNull(),
    role: varchar("role", { length: 10 }).notNull(), // cause | effect
  },
  (t) => [index("decision_links_decision_idx").on(t.decisionId)]
);
```

`decisionLinks` napędza overlay „dlaczego tak?" na mapie i ścieżkę wstecz (klik encji → decyzje, które ją uzasadniają). `entityId` jest poliмorficzny (brak FK) — walidacja typu po stronie aplikacji.

## 3. Kampanie i reklamy — `campaigns` + `funnelElementCampaigns`

```ts
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    pathId: uuid("path_id").references(() => strategyPaths.id, { onDelete: "set null" }),
    segmentId: uuid("segment_id").references(() => segments.id, { onDelete: "set null" }),
    landingPageId: uuid("landing_page_id").references(() => pages.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    goal: text("goal"),
    stage: varchar("stage", { length: 20 }), // TOFU | MOFU | BOFU | retention
    channels: jsonb("channels"),            // [{ channelId, label }]
    budgetPlan: integer("budget_plan"),
    budgetSpent: integer("budget_spent"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    creatives: jsonb("creatives"),          // [{ label, url }]
    utm: jsonb("utm"),                       // { source, medium, campaign, ... }
    status: varchar("status", { length: 50 }).default("planned"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("campaigns_project_idx").on(t.projectId)]
);

export const funnelElementCampaigns = pgTable(
  "funnel_element_campaigns",
  {
    funnelElementId: uuid("funnel_element_id").notNull().references(() => funnelElements.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.funnelElementId, t.campaignId] })]
);
```

Relacja `funnelElementCampaigns` = krawędź grafu wpływu „promowany przez" (element → kampania).

## 4. GEO / AEO — `geoAssets`, `geoQueries` + `funnelElementGeo`

```ts
export const geoAssets = pgTable(
  "geo_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    type: varchar("type", { length: 50 }).notNull(), // llms_txt | schema_jsonld | answer_page | faq
    checklist: jsonb("checklist"), // [{ label, done }]
    status: varchar("status", { length: 50 }).default("todo"),
    notesMd: text("notes_md"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("geo_assets_project_idx").on(t.projectId)]
);

export const geoQueries = pgTable(
  "geo_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    targetPageId: uuid("target_page_id").references(() => pages.id, { onDelete: "set null" }),
    query: text("query").notNull(),
    intent: varchar("intent", { length: 100 }),
    stage: varchar("stage", { length: 20 }),
    citationStatus: jsonb("citation_status"), // { chatgpt, perplexity, aiOverview: "cited"|"missing"|"unknown" }
    status: varchar("status", { length: 50 }).default("monitoring"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("geo_queries_project_idx").on(t.projectId)]
);

export const funnelElementGeo = pgTable(
  "funnel_element_geo",
  {
    funnelElementId: uuid("funnel_element_id").notNull().references(() => funnelElements.id, { onDelete: "cascade" }),
    geoAssetId: uuid("geo_asset_id").notNull().references(() => geoAssets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.funnelElementId, t.geoAssetId] })]
);
```

Relacja `funnelElementGeo` = krawędź „cytowalny w AI przez".

## 5. Produkty i usługi — `offers` + `offerSegments`

```ts
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).default("product"), // product | service | package
    pricingMd: text("pricing_md"),
    uvpMd: text("uvp_md"),
    status: varchar("status", { length: 50 }).default("active"),
    orderIdx: integer("order_idx").default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("offers_project_idx").on(t.projectId)]
);

export const offerSegments = pgTable(
  "offer_segments",
  {
    offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.segmentId] })]
);
```

## 6. Komentarze per encja — `entityComments`

```ts
export const entityComments = pgTable(
  "entity_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    authorType: varchar("author_type", { length: 10 }).default("team"), // team | client | ai
    authorName: varchar("author_name", { length: 255 }),
    body: text("body").notNull(),
    mentions: jsonb("mentions"), // ["kamil","klient"]
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("entity_comments_entity_idx").on(t.entityType, t.entityId)]
);
```

Wątki per encja (segment, obiekcja, podstrona, KPI, …). Mentions `@kamil`/`@klient` + notyfikacje e-mail (Resend) — Faza 7. Klient komentuje w Dashboardzie, komentarz widać też w Hubie (wspólna tabela).

## 7. Silnik reguł — `strategyRuleSets`

Szczegóły kształtu `config` i sposobu użycia: `03-silnik-regul-i-ustawienia.md`. Tabela:

```ts
export const strategyRuleSets = pgTable(
  "strategy_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 'global' = domyślne reguły; w przeciwnym razie nadpisanie per projekt
    scope: varchar("scope", { length: 64 }).notNull(), // 'global' | <projectId>
    config: jsonb("config").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("strategy_rule_sets_scope_uq").on(t.scope)]
);
```

`scope` unikalny → upsert po scope. Seed wstawia jeden rekord `scope = 'global'` z konfiguracją = obecne wartości zahardkodowane (zero regresji).

## 8. Rozszerzenie grafu wpływu (typy + kolory)

[lib/strategy-hub/strategy-map-types.ts](lib/strategy-hub/strategy-map-types.ts): `InfluenceEntityType` rozszerzyć o `"campaign"` i `"geo"`; dodać do `ENTITY_COLORS` i `ENTITY_LABELS` (limit ~8–10 semantycznych kolorów — spec: „więcej = chaos"):

- `campaign`: `#a78bfa` (🟪 kampania/reklama)
- `geo`: `#22d3ee` (🤖 GEO/AEO asset)

Nowe etykiety krawędzi w grafie: `"promowany przez"` (element→campaign), `"cytowalny w AI przez"` (element→geo). Builder grafu w [lib/strategy-hub/strategy-map.ts](lib/strategy-hub/strategy-map.ts) dołącza węzły z `campaigns`/`geoAssets` przez join `funnelElementCampaigns`/`funnelElementGeo`. Semantyka relacji docelowo czytana z silnika reguł (sekcja Korelacje).

## 9. Rejestracja encji w registry.ts (lista do dodania)

Dodać `listDef` dla: `sites`, `decisions` (`strategicDecisions`), `campaigns`, `geo-assets`, `geo-queries`, `offers`, `comments` (`entityComments`). Dla każdej: `createSchema`/`patchSchema` (Zod), `list/create/update/softDelete` z filtrem `projectId` + `isNull(deletedAt)`; `supportsPath: true` dla `campaigns` (ma `pathId`). Encje z relacjami N:N (kampanie↔elementy, oferty↔segmenty, decisionLinks) wymagają dodatkowych endpointów relacji wzorowanych na [app/api/strategy-hub/projects/[id]/funnel-elements/[elementId]/relations/route.ts](app/api/strategy-hub/projects/[id]/funnel-elements/[elementId]/relations/route.ts).

## 10. Kolejność implementacji DB (mapuje na fazy)

1. Faza 0: `strategyRuleSets` + seed global.
2. Faza 2: `sites` + `siteId` + migracja danych (primary site).
3. Faza 3: `strategicDecisions` + `decisionLinks`.
4. Faza 4: `campaigns` + `funnelElementCampaigns`; `geoAssets`/`geoQueries` + `funnelElementGeo`; `offers` + `offerSegments`; rozszerzenie typów grafu.
5. Faza 6: `entityComments`.

Po każdej zmianie schematu: `pnpm drizzle:generate` → przegląd SQL → `pnpm drizzle:migrate` (dev) / `db:push`. Zweryfikować `pnpm typecheck`.
