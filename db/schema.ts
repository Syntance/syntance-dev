import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  uuid,
  varchar,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Multi-tenancy ───────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    role: varchar("role", { length: 20 }).notNull().default("client"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("users_workspace_idx").on(t.workspaceId)]
);

// ─── Projekty ────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    icon: varchar("icon", { length: 10 }),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    domain: varchar("domain", { length: 255 }),
    description: text("description"),
    clientName: varchar("client_name", { length: 255 }),
    notionPageUrl: text("notion_page_url"),
    clientAccessToken: text("client_access_token"),
    clientAccessExpiresAt: timestamp("client_access_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("projects_workspace_idx").on(t.workspaceId),
    index("projects_slug_workspace_idx").on(t.slug, t.workspaceId),
  ]
);

// ─── Strategia biznesowa (LEGACY — do usunięcia po migracji w PR 1.5) ───────

export const businessStrategy = pgTable("business_strategy", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  goalsMd: text("goals_md"),
  uvpMd: text("uvp_md"),
  competitorsMd: text("competitors_md"),
  objectionsMd: text("objections_md"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

// ─── Strategia biznesowa (relacyjna) ─────────────────────────────────────────

/**
 * Problemy / ambicje biznesowe.
 * Jeden problem = jeden wiersz, z opcjonalną ambicją (co chcemy osiągnąć)
 * i naszym proponowanym rozwiązaniem.
 * Priority 1=Neutralne, 2=Średnie, 3=Ważne (zgodnie z `StrategyListWeight`).
 */
export const businessProblems = pgTable(
  "business_problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    problemMd: text("problem_md").notNull(),
    ambitionMd: text("ambition_md"),
    ourSolutionMd: text("our_solution_md"),
    priority: integer("priority").notNull().default(2),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("business_problems_project_idx").on(t.projectId)]
);

/**
 * UVP (Unique Value Proposition) projektu — jeden wiersz per projekt.
 * Główne UVP, wartości dodane (lista calloutów w formacie list-items
 * — przejściowo zachowujemy serializację JSON dla kompatybilności)
 * + strukturalne wyróżniki.
 */
export const uvp = pgTable("uvp", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  coreUvpMd: text("core_uvp_md"),
  /** Markdown (spec): lista wartości dodanych. */
  valueAddsMd: text("value_adds_md"),
  /** JSON: serializowana lista StrategyListItem[] (text/note/weight) — legacy/UI. */
  valueAddsJson: text("value_adds_json"),
  /** [{title: string, description: string}] */
  differentiators: jsonb("differentiators"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

/**
 * Pozycjonowanie marki — quadrant chart (drag&drop w UI).
 * Osie konfigurowalne, pozycja "nas" + lista konkurentów na quadrancie.
 * Wartości X/Y z zakresu -1.0 do 1.0 (środek = 0,0).
 */
export const brandPositioning = pgTable("brand_positioning", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  axisXLabel: varchar("axis_x_label", { length: 100 }),
  axisYLabel: varchar("axis_y_label", { length: 100 }),
  ourX: real("our_x"),
  ourY: real("our_y"),
  ourLabel: varchar("our_label", { length: 100 }),
  /** [{label: string, x: number, y: number}] — markery konkurencji */
  competitorsOnQuadrant: jsonb("competitors_on_quadrant"),
  statementMd: text("statement_md"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

/**
 * Konkurenci — lista per projekt.
 * Typ: `direct` (bezpośrednia), `indirect` (pośrednia), `none` ("nic nie robię").
 * Quadrant X/Y opcjonalne — gdy jest mapping na pozycjonowanie.
 */
export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Główny segment dla którego ten konkurent jest istotny (opcjonalnie). */
    segmentId: uuid("segment_id"),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url"),
    type: varchar("type", { length: 20 }).notNull().default("direct"),
    strengthsMd: text("strengths_md"),
    weaknessesMd: text("weaknesses_md"),
    pricingMd: text("pricing_md"),
    channelsMd: text("channels_md"),
    notesMd: text("notes_md"),
    quadrantX: real("quadrant_x"),
    quadrantY: real("quadrant_y"),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("competitors_project_idx").on(t.projectId),
    index("competitors_segment_idx").on(t.segmentId),
  ]
);

/**
 * Obiekcje klientów — z dowodem.
 * Może być powiązana z segmentem i etapem zakupu (TOFU/MOFU/BOFU/retention).
 * Status: `active` (aktualna), `resolved` (zaadresowana), `needs_proof` (brak dowodu).
 */
export const objections = pgTable(
  "objections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id"),
    stage: varchar("stage", { length: 20 }),
    objectionMd: text("objection_md").notNull(),
    responseMd: text("response_md"),
    proofMd: text("proof_md"),
    priority: integer("priority").notNull().default(2),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("objections_project_idx").on(t.projectId),
    index("objections_segment_idx").on(t.segmentId),
  ]
);

// ─── Strategia marketingowa ──────────────────────────────────────────────────

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }),
    name: varchar("name", { length: 255 }).notNull(),
    personaName: varchar("persona_name", { length: 255 }),
    icon: varchar("icon", { length: 10 }),
    priority: integer("priority").default(0),
    revenueSharePct: integer("revenue_share_pct"),
    status: varchar("status", { length: 50 }).default("active"),
    orderIdx: integer("order_idx").default(0),
    // Karta segmentu (8 sekcji)
    demographicsMd: text("demographics_md"),
    jtbdMd: text("jtbd_md"),
    problemMd: text("problem_md"),
    uvpForSegmentMd: text("uvp_for_segment_md"),
    emotionalDriversMd: text("emotional_drivers_md"),
    triggersMd: text("triggers_md"),
    blockersMd: text("blockers_md"),
    mentalityMd: text("mentality_md"),
    budgetMd: text("budget_md"),
    marketSizeMd: text("market_size_md"),
    /** [{label, value, source}] — TAM/SAM/SOM itp. */
    marketData: jsonb("market_data"),
    /** [{kpi, target, unit}] */
    kpiTargets: jsonb("kpi_targets"),
    segmentPricingMd: text("segment_pricing_md"),
    /** {fit: number, value: number, effort: number, total: number} */
    scoring: jsonb("scoring"),
    // ── Legacy (zachowane dla kompatybilności) ──
    persona: text("persona"),
    jtbd: text("jtbd"),
    problem: text("problem"),
    uvpText: text("uvp_text"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("segments_project_idx").on(t.projectId)]
);

export const purchaseStages = pgTable(
  "purchase_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phase: varchar("phase", { length: 100 }),
    orderIdx: integer("order_idx").default(0),
    trigger: text("trigger"),
    objections: text("objections"),
    emotionalState: text("emotional_state"),
    questions: text("questions"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("purchase_stages_segment_idx").on(t.segmentId)]
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }),
    icon: varchar("icon", { length: 10 }),
    costMonthly: integer("cost_monthly"),
    description: text("description"),
    status: varchar("status", { length: 50 }).default("active"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("channels_project_idx").on(t.projectId)]
);

export const funnelElements = pgTable(
  "funnel_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => purchaseStages.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    position: integer("position").default(0),
    contentMd: text("content_md"),
    cta: varchar("cta", { length: 255 }),
    ctaUrl: varchar("cta_url", { length: 500 }),
    format: varchar("format", { length: 100 }),
    status: varchar("status", { length: 50 }).default("draft"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("funnel_elements_stage_idx").on(t.stageId)]
);

export const funnelElementChannels = pgTable(
  "funnel_element_channels",
  {
    funnelElementId: uuid("funnel_element_id")
      .notNull()
      .references(() => funnelElements.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.funnelElementId, t.channelId] })]
);

export const funnelElementKpis = pgTable(
  "funnel_element_kpis",
  {
    funnelElementId: uuid("funnel_element_id")
      .notNull()
      .references(() => funnelElements.id, { onDelete: "cascade" }),
    kpiId: uuid("kpi_id")
      .notNull()
      .references(() => kpis.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.funnelElementId, t.kpiId] })]
);

export const userFlowPages = pgTable(
  "user_flow_pages",
  {
    userFlowId: uuid("user_flow_id")
      .notNull()
      .references(() => userFlows.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userFlowId, t.pageId] })]
);

export const userFlows = pgTable(
  "user_flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    entryElementId: uuid("entry_element_id"),
    name: varchar("name", { length: 255 }).notNull(),
    stepsMd: text("steps_md"),
    conversionGoal: text("conversion_goal"),
    type: varchar("type", { length: 100 }),
    status: varchar("status", { length: 50 }).default("draft"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("user_flows_project_idx").on(t.projectId)]
);

export const kpis = pgTable(
  "kpis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    target: varchar("target", { length: 100 }),
    actual: varchar("actual", { length: 100 }),
    unit: varchar("unit", { length: 50 }),
    category: varchar("category", { length: 100 }),
    deadline: timestamp("deadline"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("kpis_project_idx").on(t.projectId)]
);

export const kpiSnapshots = pgTable(
  "kpi_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kpiId: uuid("kpi_id")
      .notNull()
      .references(() => kpis.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 100 }).notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    note: text("note"),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("kpi_snapshots_kpi_idx").on(t.kpiId)]
);

// ─── Strategia strony ────────────────────────────────────────────────────────

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    urlPath: varchar("url_path", { length: 255 }),
    type: varchar("type", { length: 100 }),
    layoutTemplate: varchar("layout_template", { length: 100 }),
    roleInFunnel: text("role_in_funnel"),
    cta: varchar("cta", { length: 255 }),
    goal: text("goal"),
    status: varchar("status", { length: 50 }).default("draft"),
    priority: integer("priority").default(0),
    priorityTier: varchar("priority_tier", { length: 20 }),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("pages_project_idx").on(t.projectId)]
);

export const seoKeywords = pgTable(
  "seo_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    phrase: varchar("phrase", { length: 500 }).notNull(),
    intent: varchar("intent", { length: 100 }),
    volume: integer("volume"),
    difficulty: integer("difficulty"),
    priority: integer("priority").default(0),
    funnelStage: varchar("funnel_stage", { length: 100 }),
    targetPageId: uuid("target_page_id").references(() => pages.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 50 }).default("research"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("seo_keywords_project_idx").on(t.projectId)]
);

export const techStack = pgTable(
  "tech_stack",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    monthlyCost: integer("monthly_cost"),
    yearlyCost: integer("yearly_cost"),
    description: text("description"),
    url: text("url"),
    status: varchar("status", { length: 50 }).default("active"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("tech_stack_project_idx").on(t.projectId)]
);

// ─── Dashboard klienta ────────────────────────────────────────────────────────

export const hostingServices = pgTable(
  "hosting_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }),
    provider: varchar("provider", { length: 100 }),
    url: text("url"),
    status: varchar("status", { length: 50 }).default("active"),
    monthlyCost: integer("monthly_cost"),
    notes: text("notes"),
  },
  (t) => [index("hosting_services_project_idx").on(t.projectId)]
);

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    registrar: varchar("registrar", { length: 100 }),
    expiresAt: timestamp("expires_at"),
    sslStatus: varchar("ssl_status", { length: 50 }),
    dnsProvider: varchar("dns_provider", { length: 100 }),
  },
  (t) => [index("domains_project_idx").on(t.projectId)]
);

export const clientResources = pgTable(
  "client_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    url: text("url").notNull(),
    category: varchar("category", { length: 100 }),
    icon: varchar("icon", { length: 10 }),
    orderIdx: integer("order_idx").default(0),
  },
  (t) => [index("client_resources_project_idx").on(t.projectId)]
);

// ─── Notion sync ─────────────────────────────────────────────────────────────

export const notionMappings = pgTable(
  "notion_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    notionUrl: text("notion_url"),
    notionDataSourceUrl: text("notion_data_source_url"),
    lastSyncedAt: timestamp("last_synced_at"),
    lastSyncedDirection: varchar("last_synced_direction", { length: 20 }),
  },
  (t) => [index("notion_mappings_entity_idx").on(t.entityType, t.entityId)]
);

export const notionSyncLog = pgTable(
  "notion_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    direction: varchar("direction", { length: 20 }),
    status: varchar("status", { length: 50 }),
    error: text("error"),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (t) => [index("notion_sync_log_project_idx").on(t.projectId)]
);

// ─── Aktywność AI + tracking klienta ─────────────────────────────────────────

export const aiActionsLog = pgTable(
  "ai_actions_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    source: varchar("source", { length: 50 }),
    toolName: varchar("tool_name", { length: 100 }),
    inputJson: jsonb("input_json"),
    outputJson: jsonb("output_json"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ai_actions_log_project_idx").on(t.projectId)]
);

export const clientVisitsLog = pgTable(
  "client_visits_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    section: varchar("section", { length: 100 }),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (t) => [index("client_visits_log_project_idx").on(t.projectId)]
);

// ─── Discovery / Onboarding ──────────────────────────────────────────────────

export const projectQuestions = pgTable(
  "project_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }),
    question: text("question").notNull(),
    answerMd: text("answer_md"),
    ourAnalysisMd: text("our_analysis_md"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_questions_project_idx").on(t.projectId)]
);

export const projectGlossary = pgTable(
  "project_glossary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 255 }).notNull(),
    definitionMd: text("definition_md"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_glossary_project_idx").on(t.projectId)]
);

export const projectCredentials = pgTable(
  "project_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    serviceName: varchar("service_name", { length: 255 }).notNull(),
    url: text("url"),
    login: varchar("login", { length: 255 }),
    /** Zaszyfrowany sekret (AES-GCM) — nigdy plaintext. */
    encryptedSecret: text("encrypted_secret"),
    category: varchar("category", { length: 100 }),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_credentials_project_idx").on(t.projectId)]
);

export const projectMaterials = pgTable(
  "project_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }),
    title: varchar("title", { length: 255 }).notNull(),
    url: text("url"),
    source: varchar("source", { length: 100 }),
    fileId: varchar("file_id", { length: 255 }),
    notesMd: text("notes_md"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_materials_project_idx").on(t.projectId)]
);

export const projectNotes = pgTable(
  "project_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorType: varchar("author_type", { length: 20 }).notNull().default("team"),
    contentMd: text("content_md").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_notes_project_idx").on(t.projectId)]
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    descriptionMd: text("description_md"),
    status: varchar("status", { length: 30 }).notNull().default("todo"),
    owner: varchar("owner", { length: 100 }),
    dueDate: timestamp("due_date"),
    priority: integer("priority").notNull().default(2),
    orderIdx: integer("order_idx").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_tasks_project_idx").on(t.projectId)]
);

// ─── Marka ───────────────────────────────────────────────────────────────────

export const brandIdentity = pgTable("brand_identity", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  missionMd: text("mission_md"),
  visionMd: text("vision_md"),
  purposeMd: text("purpose_md"),
  brandPillarsMd: text("brand_pillars_md"),
  toneOfVoiceMd: text("tone_of_voice_md"),
  brandPersonalityMd: text("brand_personality_md"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

export const brandVisual = pgTable("brand_visual", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** [{label, url, kind}] */
  logoFiles: jsonb("logo_files"),
  /** [{name, hex, oklch, role}] */
  colors: jsonb("colors"),
  /** [{role, family, weights, url}] */
  typography: jsonb("typography"),
  brandbookUrl: text("brandbook_url"),
  usageGuidelinesMd: text("usage_guidelines_md"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

// ─── Strategia biznesowa: kryteria segmentacji ───────────────────────────────

export const marketSegmentationCriteria = pgTable(
  "market_segmentation_criteria",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** [{dimension, description, values: string[]}] */
    dimensions: jsonb("dimensions"),
    notesMd: text("notes_md"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  }
);

// ─── Segmenty: dzieci ────────────────────────────────────────────────────────

export const buyerJourneyStages = pgTable(
  "buyer_journey_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    whatDoesMd: text("what_does_md"),
    timeHint: varchar("time_hint", { length: 100 }),
    ourActionMd: text("our_action_md"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("buyer_journey_stages_segment_idx").on(t.segmentId)]
);

export const segmentQuickWins = pgTable(
  "segment_quick_wins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    descriptionMd: text("description_md"),
    deadline: timestamp("deadline"),
    status: varchar("status", { length: 30 }).notNull().default("planned"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("segment_quick_wins_segment_idx").on(t.segmentId)]
);

export const segmentRisks = pgTable(
  "segment_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    riskMd: text("risk_md").notNull(),
    mitigationMd: text("mitigation_md"),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("segment_risks_segment_idx").on(t.segmentId)]
);

// ─── Kanały: plan aktywności ─────────────────────────────────────────────────

export const channelActivityPlan = pgTable(
  "channel_activity_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    stage: varchar("stage", { length: 20 }),
    whatToPublishMd: text("what_to_publish_md"),
    cadence: varchar("cadence", { length: 100 }),
    weeklyCount: integer("weekly_count"),
    monthlyBudget: integer("monthly_budget"),
    priority: integer("priority").notNull().default(2),
    notesMd: text("notes_md"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("channel_activity_plan_channel_idx").on(t.channelId),
    index("channel_activity_plan_segment_idx").on(t.segmentId),
  ]
);

// ─── Sprzedaż / copywriting ──────────────────────────────────────────────────

export const salesPitches = pgTable(
  "sales_pitches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    context: varchar("context", { length: 100 }),
    title: varchar("title", { length: 255 }).notNull(),
    pitchMd: text("pitch_md"),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("sales_pitches_project_idx").on(t.projectId),
    index("sales_pitches_segment_idx").on(t.segmentId),
  ]
);

export const salesScripts = pgTable(
  "sales_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    context: varchar("context", { length: 100 }),
    name: varchar("name", { length: 255 }).notNull(),
    scriptMd: text("script_md"),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("sales_scripts_project_idx").on(t.projectId)]
);

export const leadMagnets = pgTable(
  "lead_magnets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    format: varchar("format", { length: 100 }),
    descriptionMd: text("description_md"),
    url: text("url"),
    conversionTarget: varchar("conversion_target", { length: 100 }),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    orderIdx: integer("order_idx").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("lead_magnets_project_idx").on(t.projectId),
    index("lead_magnets_segment_idx").on(t.segmentId),
  ]
);

export const copyGuidelines = pgTable("copy_guidelines", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  principlesMd: text("principles_md"),
  doMd: text("do_md"),
  dontMd: text("dont_md"),
  /** [{name, body}] */
  templates: jsonb("templates"),
  /** string[] */
  hashtags: jsonb("hashtags"),
  /** [{label, body}] */
  examples: jsonb("examples"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

// ─── Strategia strony: dzieci ────────────────────────────────────────────────

export const pageSections = pgTable(
  "page_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    orderIdx: integer("order_idx").notNull().default(0),
    purposeMd: text("purpose_md"),
    schemaMd: text("schema_md"),
    copyMd: text("copy_md"),
    ctaText: varchar("cta_text", { length: 255 }),
    ctaUrl: varchar("cta_url", { length: 500 }),
    designNotesMd: text("design_notes_md"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("page_sections_page_idx").on(t.pageId)]
);

export const navItems = pgTable(
  "nav_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    url: varchar("url", { length: 500 }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    position: varchar("position", { length: 50 }),
    type: varchar("type", { length: 50 }),
    parentId: uuid("parent_id"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("nav_items_project_idx").on(t.projectId)]
);

export const siteMaintenanceCosts = pgTable(
  "site_maintenance_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    item: varchar("item", { length: 255 }).notNull(),
    monthlyCost: integer("monthly_cost"),
    yearlyCost: integer("yearly_cost"),
    provider: varchar("provider", { length: 100 }),
    notesMd: text("notes_md"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("site_maintenance_costs_project_idx").on(t.projectId)]
);

export const siteAudits = pgTable(
  "site_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }),
    date: timestamp("date").defaultNow().notNull(),
    summaryMd: text("summary_md"),
    severityHigh: integer("severity_high").default(0),
    severityMedium: integer("severity_medium").default(0),
    severityLow: integer("severity_low").default(0),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("site_audits_project_idx").on(t.projectId)]
);

export const siteAuditFindings = pgTable(
  "site_audit_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => siteAudits.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    area: varchar("area", { length: 100 }),
    findingMd: text("finding_md").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    recommendationMd: text("recommendation_md"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    orderIdx: integer("order_idx").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("site_audit_findings_audit_idx").on(t.auditId)]
);

// ─── Historia zmian (audit trail) ────────────────────────────────────────────

export const changeHistory = pgTable(
  "change_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    field: varchar("field", { length: 100 }),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("change_history_project_idx").on(t.projectId)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  projects: many(projects),
  users: many(users),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  businessStrategy: one(businessStrategy, {
    fields: [projects.id],
    references: [businessStrategy.projectId],
  }),
  uvp: one(uvp, {
    fields: [projects.id],
    references: [uvp.projectId],
  }),
  brandPositioning: one(brandPositioning, {
    fields: [projects.id],
    references: [brandPositioning.projectId],
  }),
  marketSegmentationCriteria: one(marketSegmentationCriteria, {
    fields: [projects.id],
    references: [marketSegmentationCriteria.projectId],
  }),
  brandIdentity: one(brandIdentity, {
    fields: [projects.id],
    references: [brandIdentity.projectId],
  }),
  brandVisual: one(brandVisual, {
    fields: [projects.id],
    references: [brandVisual.projectId],
  }),
  copyGuidelines: one(copyGuidelines, {
    fields: [projects.id],
    references: [copyGuidelines.projectId],
  }),
  businessProblems: many(businessProblems),
  competitors: many(competitors),
  objections: many(objections),
  segments: many(segments),
  channels: many(channels),
  userFlows: many(userFlows),
  kpis: many(kpis),
  pages: many(pages),
  seoKeywords: many(seoKeywords),
  techStack: many(techStack),
  hostingServices: many(hostingServices),
  domains: many(domains),
  clientResources: many(clientResources),
  questions: many(projectQuestions),
  glossary: many(projectGlossary),
  credentials: many(projectCredentials),
  materials: many(projectMaterials),
  notes: many(projectNotes),
  tasks: many(projectTasks),
  salesPitches: many(salesPitches),
  salesScripts: many(salesScripts),
  leadMagnets: many(leadMagnets),
  navItems: many(navItems),
  siteMaintenanceCosts: many(siteMaintenanceCosts),
  siteAudits: many(siteAudits),
  changeHistory: many(changeHistory),
}));

export const businessProblemsRelations = relations(
  businessProblems,
  ({ one }) => ({
    project: one(projects, {
      fields: [businessProblems.projectId],
      references: [projects.id],
    }),
  })
);

export const uvpRelations = relations(uvp, ({ one }) => ({
  project: one(projects, {
    fields: [uvp.projectId],
    references: [projects.id],
  }),
}));

export const brandPositioningRelations = relations(
  brandPositioning,
  ({ one }) => ({
    project: one(projects, {
      fields: [brandPositioning.projectId],
      references: [projects.id],
    }),
  })
);

export const competitorsRelations = relations(competitors, ({ one }) => ({
  project: one(projects, {
    fields: [competitors.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [competitors.segmentId],
    references: [segments.id],
  }),
}));

export const objectionsRelations = relations(objections, ({ one }) => ({
  project: one(projects, {
    fields: [objections.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [objections.segmentId],
    references: [segments.id],
  }),
}));

export const segmentsRelations = relations(segments, ({ one, many }) => ({
  project: one(projects, {
    fields: [segments.projectId],
    references: [projects.id],
  }),
  purchaseStages: many(purchaseStages),
  kpis: many(kpis),
  userFlows: many(userFlows),
  competitors: many(competitors),
  objections: many(objections),
  buyerJourneyStages: many(buyerJourneyStages),
  quickWins: many(segmentQuickWins),
  risks: many(segmentRisks),
  channelActivityPlan: many(channelActivityPlan),
  salesPitches: many(salesPitches),
  leadMagnets: many(leadMagnets),
}));

export const purchaseStagesRelations = relations(
  purchaseStages,
  ({ one, many }) => ({
    segment: one(segments, {
      fields: [purchaseStages.segmentId],
      references: [segments.id],
    }),
    funnelElements: many(funnelElements),
  })
);

export const funnelElementsRelations = relations(
  funnelElements,
  ({ one, many }) => ({
    stage: one(purchaseStages, {
      fields: [funnelElements.stageId],
      references: [purchaseStages.id],
    }),
    segment: one(segments, {
      fields: [funnelElements.segmentId],
      references: [segments.id],
    }),
    channels: many(funnelElementChannels),
    kpis: many(funnelElementKpis),
  })
);

export const channelsRelations = relations(channels, ({ one, many }) => ({
  project: one(projects, {
    fields: [channels.projectId],
    references: [projects.id],
  }),
  funnelElements: many(funnelElementChannels),
  activityPlan: many(channelActivityPlan),
}));

export const funnelElementChannelsRelations = relations(
  funnelElementChannels,
  ({ one }) => ({
    funnelElement: one(funnelElements, {
      fields: [funnelElementChannels.funnelElementId],
      references: [funnelElements.id],
    }),
    channel: one(channels, {
      fields: [funnelElementChannels.channelId],
      references: [channels.id],
    }),
  })
);

export const funnelElementKpisRelations = relations(
  funnelElementKpis,
  ({ one }) => ({
    funnelElement: one(funnelElements, {
      fields: [funnelElementKpis.funnelElementId],
      references: [funnelElements.id],
    }),
    kpi: one(kpis, {
      fields: [funnelElementKpis.kpiId],
      references: [kpis.id],
    }),
  })
);

export const userFlowsRelations = relations(userFlows, ({ one, many }) => ({
  project: one(projects, {
    fields: [userFlows.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [userFlows.segmentId],
    references: [segments.id],
  }),
  pages: many(userFlowPages),
}));

export const userFlowPagesRelations = relations(userFlowPages, ({ one }) => ({
  userFlow: one(userFlows, {
    fields: [userFlowPages.userFlowId],
    references: [userFlows.id],
  }),
  page: one(pages, {
    fields: [userFlowPages.pageId],
    references: [pages.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  project: one(projects, {
    fields: [pages.projectId],
    references: [projects.id],
  }),
  sections: many(pageSections),
  userFlows: many(userFlowPages),
}));

export const pageSectionsRelations = relations(pageSections, ({ one }) => ({
  page: one(pages, {
    fields: [pageSections.pageId],
    references: [pages.id],
  }),
}));

export const projectQuestionsRelations = relations(projectQuestions, ({ one }) => ({
  project: one(projects, {
    fields: [projectQuestions.projectId],
    references: [projects.id],
  }),
}));

export const projectGlossaryRelations = relations(projectGlossary, ({ one }) => ({
  project: one(projects, {
    fields: [projectGlossary.projectId],
    references: [projects.id],
  }),
}));

export const projectCredentialsRelations = relations(
  projectCredentials,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectCredentials.projectId],
      references: [projects.id],
    }),
  })
);

export const projectMaterialsRelations = relations(
  projectMaterials,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectMaterials.projectId],
      references: [projects.id],
    }),
  })
);

export const projectNotesRelations = relations(projectNotes, ({ one }) => ({
  project: one(projects, {
    fields: [projectNotes.projectId],
    references: [projects.id],
  }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  project: one(projects, {
    fields: [projectTasks.projectId],
    references: [projects.id],
  }),
}));

export const brandIdentityRelations = relations(brandIdentity, ({ one }) => ({
  project: one(projects, {
    fields: [brandIdentity.projectId],
    references: [projects.id],
  }),
}));

export const brandVisualRelations = relations(brandVisual, ({ one }) => ({
  project: one(projects, {
    fields: [brandVisual.projectId],
    references: [projects.id],
  }),
}));

export const marketSegmentationCriteriaRelations = relations(
  marketSegmentationCriteria,
  ({ one }) => ({
    project: one(projects, {
      fields: [marketSegmentationCriteria.projectId],
      references: [projects.id],
    }),
  })
);

export const buyerJourneyStagesRelations = relations(
  buyerJourneyStages,
  ({ one }) => ({
    segment: one(segments, {
      fields: [buyerJourneyStages.segmentId],
      references: [segments.id],
    }),
  })
);

export const segmentQuickWinsRelations = relations(
  segmentQuickWins,
  ({ one }) => ({
    segment: one(segments, {
      fields: [segmentQuickWins.segmentId],
      references: [segments.id],
    }),
  })
);

export const segmentRisksRelations = relations(segmentRisks, ({ one }) => ({
  segment: one(segments, {
    fields: [segmentRisks.segmentId],
    references: [segments.id],
  }),
}));

export const channelActivityPlanRelations = relations(
  channelActivityPlan,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelActivityPlan.channelId],
      references: [channels.id],
    }),
    segment: one(segments, {
      fields: [channelActivityPlan.segmentId],
      references: [segments.id],
    }),
  })
);

export const salesPitchesRelations = relations(salesPitches, ({ one }) => ({
  project: one(projects, {
    fields: [salesPitches.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [salesPitches.segmentId],
    references: [segments.id],
  }),
}));

export const salesScriptsRelations = relations(salesScripts, ({ one }) => ({
  project: one(projects, {
    fields: [salesScripts.projectId],
    references: [projects.id],
  }),
}));

export const leadMagnetsRelations = relations(leadMagnets, ({ one }) => ({
  project: one(projects, {
    fields: [leadMagnets.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [leadMagnets.segmentId],
    references: [segments.id],
  }),
}));

export const copyGuidelinesRelations = relations(copyGuidelines, ({ one }) => ({
  project: one(projects, {
    fields: [copyGuidelines.projectId],
    references: [projects.id],
  }),
}));

export const navItemsRelations = relations(navItems, ({ one }) => ({
  project: one(projects, {
    fields: [navItems.projectId],
    references: [projects.id],
  }),
  page: one(pages, {
    fields: [navItems.pageId],
    references: [pages.id],
  }),
}));

export const siteMaintenanceCostsRelations = relations(
  siteMaintenanceCosts,
  ({ one }) => ({
    project: one(projects, {
      fields: [siteMaintenanceCosts.projectId],
      references: [projects.id],
    }),
  })
);

export const siteAuditsRelations = relations(siteAudits, ({ one, many }) => ({
  project: one(projects, {
    fields: [siteAudits.projectId],
    references: [projects.id],
  }),
  findings: many(siteAuditFindings),
}));

export const siteAuditFindingsRelations = relations(
  siteAuditFindings,
  ({ one }) => ({
    audit: one(siteAudits, {
      fields: [siteAuditFindings.auditId],
      references: [siteAudits.id],
    }),
    page: one(pages, {
      fields: [siteAuditFindings.pageId],
      references: [pages.id],
    }),
  })
);

export const changeHistoryRelations = relations(changeHistory, ({ one }) => ({
  project: one(projects, {
    fields: [changeHistory.projectId],
    references: [projects.id],
  }),
}));

export const kpisRelations = relations(kpis, ({ one, many }) => ({
  project: one(projects, {
    fields: [kpis.projectId],
    references: [projects.id],
  }),
  segment: one(segments, {
    fields: [kpis.segmentId],
    references: [segments.id],
  }),
  snapshots: many(kpiSnapshots),
}));

export const kpiSnapshotsRelations = relations(kpiSnapshots, ({ one }) => ({
  kpi: one(kpis, {
    fields: [kpiSnapshots.kpiId],
    references: [kpis.id],
  }),
}));
