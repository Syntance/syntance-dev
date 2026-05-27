import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
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

// ─── Strategia biznesowa ──────────────────────────────────────────────────────

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

// ─── Strategia marketingowa ──────────────────────────────────────────────────

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    persona: text("persona"),
    jtbd: text("jtbd"),
    problem: text("problem"),
    uvpText: text("uvp_text"),
    priority: integer("priority").default(0),
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
    roleInFunnel: text("role_in_funnel"),
    cta: varchar("cta", { length: 255 }),
    goal: text("goal"),
    status: varchar("status", { length: 50 }).default("draft"),
    priority: integer("priority").default(0),
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
}));

export const segmentsRelations = relations(segments, ({ one, many }) => ({
  project: one(projects, {
    fields: [segments.projectId],
    references: [projects.id],
  }),
  purchaseStages: many(purchaseStages),
  kpis: many(kpis),
  userFlows: many(userFlows),
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
