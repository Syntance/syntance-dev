import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projectQuestions,
  projectGlossary,
  projectCredentials,
  projectMaterials,
  projectNotes,
  projectTasks,
  brandIdentity,
  brandVisual,
  marketSegmentationCriteria,
  segments,
  buyerJourneyStages,
  segmentQuickWins,
  segmentRisks,
  channels,
  channelActivityPlan,
  salesPitches,
  salesScripts,
  leadMagnets,
  copyGuidelines,
  navItems,
  siteMaintenanceCosts,
  siteAudits,
  siteAuditFindings,
  pageSections,
  kpis,
  kpiSnapshots,
} from "@/db/schema";
import { encryptSecret } from "@/lib/strategy-hub/crypto";

/**
 * Centralny rejestr encji Strategy Hub.
 *
 * Zamiast ~150 niemal identycznych plików route, definiujemy każdą encję raz
 * (tabela + schematy Zod + zapytania). Dynamiczne route'y
 * (`/api/strategy-hub/projects/[id]/[entity]`) dispatchują po kluczu.
 *
 * Każda encja sama enkapsuluje swoje zapytania (konkretne referencje kolumn),
 * dzięki czemu całość jest type-safe — bez generycznego dostępu do kolumn.
 */

// ─── Typy ────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export interface ListEntityDef<TCreate = unknown, TPatch = unknown> {
  kind: "list";
  label: string;
  createSchema: z.ZodType<TCreate>;
  patchSchema: z.ZodType<TPatch>;
  list(projectId: string): Promise<Row[]>;
  create(projectId: string, data: TCreate): Promise<Row>;
  update(projectId: string, itemId: string, data: TPatch): Promise<Row | undefined>;
  softDelete(projectId: string, itemId: string): Promise<boolean>;
}

export interface SingletonEntityDef<TPatch = unknown> {
  kind: "singleton";
  label: string;
  patchSchema: z.ZodType<TPatch>;
  get(projectId: string): Promise<Row | undefined>;
  upsert(projectId: string, data: TPatch): Promise<Row>;
}

/** Granica wymazania typu — Zod waliduje wejście przed wywołaniem closures. */
function listDef<C, P>(d: ListEntityDef<C, P>): ListEntityDef {
  return d as unknown as ListEntityDef;
}
export function singletonDef<P>(d: SingletonEntityDef<P>): SingletonEntityDef {
  return d as unknown as SingletonEntityDef;
}

/** Usuwa klucze o wartości `undefined` (PATCH częściowy), zachowując typ. */
function compact<T extends Row>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/** Opcjonalne, nullowalne pole markdown/tekst. */
const md = () => z.string().nullable().optional();

// ─── Discovery: schematy ─────────────────────────────────────────────────────

const questionCreate = z.object({
  question: z.string().min(1),
  answerMd: z.string().nullable().optional(),
  ourAnalysisMd: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(["open", "answered", "blocked"]).optional(),
  orderIdx: z.number().int().optional(),
});
const questionPatch = questionCreate.partial();

const glossaryCreate = z.object({
  term: z.string().min(1).max(255),
  definitionMd: z.string().nullable().optional(),
  orderIdx: z.number().int().optional(),
});
const glossaryPatch = glossaryCreate.partial();

const credentialCreate = z.object({
  serviceName: z.string().min(1).max(255),
  url: z.string().url().nullable().optional().or(z.literal("")),
  login: z.string().max(255).nullable().optional(),
  /** Jawny sekret — zostaje zaszyfrowany po stronie serwera, nigdy nie wraca w GET. */
  secret: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});
const credentialPatch = credentialCreate.partial();

const materialCreate = z.object({
  title: z.string().min(1).max(255),
  type: z.string().max(50).nullable().optional(),
  url: z.string().nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  notesMd: z.string().nullable().optional(),
});
const materialPatch = materialCreate.partial();

const noteCreate = z.object({
  contentMd: z.string().min(1),
  authorType: z.enum(["team", "client", "ai"]).optional(),
});
const notePatch = z.object({ contentMd: z.string().min(1).optional() });

const taskCreate = z.object({
  title: z.string().min(1).max(255),
  descriptionMd: z.string().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  owner: z.string().max(100).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.number().int().min(1).max(3).optional(),
  orderIdx: z.number().int().optional(),
});
const taskPatch = taskCreate.partial();

// ─── Segmenty: schematy ──────────────────────────────────────────────────────

const segmentCreate = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(50).nullable().optional(),
  personaName: z.string().max(255).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  priority: z.number().int().nullable().optional(),
  revenueSharePct: z.number().int().min(0).max(100).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  orderIdx: z.number().int().nullable().optional(),
  demographicsMd: md(),
  jtbdMd: md(),
  problemMd: md(),
  uvpForSegmentMd: md(),
  emotionalDriversMd: md(),
  triggersMd: md(),
  blockersMd: md(),
  mentalityMd: md(),
  budgetMd: md(),
  marketSizeMd: md(),
  segmentPricingMd: md(),
  marketData: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  kpiTargets: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  scoring: z.record(z.string(), z.unknown()).nullable().optional(),
});
const segmentPatch = segmentCreate.partial();

const buyerStageCreate = z.object({
  name: z.string().min(1).max(255),
  whatDoesMd: md(),
  timeHint: z.string().max(100).nullable().optional(),
  ourActionMd: md(),
  orderIdx: z.number().int().optional(),
});
const buyerStagePatch = buyerStageCreate.partial();

const quickWinCreate = z.object({
  title: z.string().min(1).max(255),
  descriptionMd: md(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.enum(["planned", "in_progress", "done"]).optional(),
  orderIdx: z.number().int().optional(),
});
const quickWinPatch = quickWinCreate.partial();

const riskCreate = z.object({
  riskMd: z.string().min(1),
  mitigationMd: md(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  orderIdx: z.number().int().optional(),
});
const riskPatch = riskCreate.partial();

// ─── Kanały + plan aktywności: schematy ──────────────────────────────────────

const channelCreate = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(100).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  costMonthly: z.number().int().nullable().optional(),
  description: md(),
  status: z.string().max(50).nullable().optional(),
});
const channelPatch = channelCreate.partial();

const activityCreate = z.object({
  channelId: z.string().uuid(),
  segmentId: z.string().uuid().nullable().optional(),
  stage: z.enum(["TOFU", "MOFU", "BOFU", "retention"]).nullable().optional(),
  whatToPublishMd: md(),
  cadence: z.string().max(100).nullable().optional(),
  weeklyCount: z.number().int().nullable().optional(),
  monthlyBudget: z.number().int().nullable().optional(),
  priority: z.number().int().min(1).max(3).optional(),
  notesMd: md(),
  orderIdx: z.number().int().optional(),
});
const activityPatch = activityCreate.partial();

// ─── Sprzedaż / copy: schematy ───────────────────────────────────────────────

const pitchCreate = z.object({
  title: z.string().min(1).max(255),
  segmentId: z.string().uuid().nullable().optional(),
  context: z.string().max(100).nullable().optional(),
  pitchMd: md(),
  version: z.number().int().min(1).optional(),
  status: z.enum(["draft", "review", "approved", "archived"]).optional(),
  orderIdx: z.number().int().optional(),
});
const pitchPatch = pitchCreate.partial();

const scriptCreate = z.object({
  name: z.string().min(1).max(255),
  context: z.string().max(100).nullable().optional(),
  scriptMd: md(),
  version: z.number().int().min(1).optional(),
  status: z.enum(["draft", "review", "approved", "archived"]).optional(),
  orderIdx: z.number().int().optional(),
});
const scriptPatch = scriptCreate.partial();

const leadMagnetCreate = z.object({
  name: z.string().min(1).max(255),
  segmentId: z.string().uuid().nullable().optional(),
  format: z.string().max(100).nullable().optional(),
  descriptionMd: md(),
  url: z.string().nullable().optional(),
  conversionTarget: z.string().max(100).nullable().optional(),
  status: z.enum(["draft", "live", "paused", "archived"]).optional(),
  orderIdx: z.number().int().optional(),
});
const leadMagnetPatch = leadMagnetCreate.partial();

const copyGuidelinesPatch = z.object({
  principlesMd: md(),
  doMd: md(),
  dontMd: md(),
  templates: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  hashtags: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  examples: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
});

// ─── Strona: schematy ────────────────────────────────────────────────────────

const navItemCreate = z.object({
  label: z.string().min(1).max(255),
  url: z.string().max(500).nullable().optional(),
  pageId: z.string().uuid().nullable().optional(),
  position: z.enum(["header", "footer", "sidebar", "mobile"]).nullable().optional(),
  type: z.string().max(50).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  orderIdx: z.number().int().optional(),
});
const navItemPatch = navItemCreate.partial();

const maintenanceCreate = z.object({
  item: z.string().min(1).max(255),
  monthlyCost: z.number().int().nullable().optional(),
  yearlyCost: z.number().int().nullable().optional(),
  provider: z.string().max(100).nullable().optional(),
  notesMd: md(),
});
const maintenancePatch = maintenanceCreate.partial();

const auditCreate = z.object({
  type: z.string().max(50).nullable().optional(),
  date: z.coerce.date().optional(),
  summaryMd: md(),
  severityHigh: z.number().int().min(0).optional(),
  severityMedium: z.number().int().min(0).optional(),
  severityLow: z.number().int().min(0).optional(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
});
const auditPatch = auditCreate.partial();

const pageSectionCreate = z.object({
  name: z.string().min(1).max(255),
  purposeMd: md(),
  schemaMd: md(),
  copyMd: md(),
  ctaText: z.string().max(255).nullable().optional(),
  ctaUrl: z.string().max(500).nullable().optional(),
  designNotesMd: md(),
  orderIdx: z.number().int().optional(),
});
const pageSectionPatch = pageSectionCreate.partial();

const findingCreate = z.object({
  findingMd: z.string().min(1),
  area: z.string().max(100).nullable().optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  recommendationMd: md(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  pageId: z.string().uuid().nullable().optional(),
  orderIdx: z.number().int().optional(),
});
const findingPatch = findingCreate.partial();

// ─── KPI: schematy ───────────────────────────────────────────────────────────

const kpiCreate = z.object({
  name: z.string().min(1).max(255),
  target: z.string().max(100).nullable().optional(),
  actual: z.string().max(100).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
});
const kpiPatch = kpiCreate.partial();

const snapshotCreate = z.object({
  value: z.string().min(1).max(100),
  recordedAt: z.coerce.date().optional(),
  note: z.string().nullable().optional(),
});
const snapshotPatch = snapshotCreate.partial();

// ─── Rejestr encji listowych ─────────────────────────────────────────────────

const listEntities: Record<string, ListEntityDef> = {
  questions: listDef({
    kind: "list",
    label: "Pytanie",
    createSchema: questionCreate,
    patchSchema: questionPatch,
    list: (pid) =>
      db
        .select()
        .from(projectQuestions)
        .where(
          and(eq(projectQuestions.projectId, pid), isNull(projectQuestions.deletedAt))
        )
        .orderBy(asc(projectQuestions.orderIdx), asc(projectQuestions.createdAt)),
    create: (pid, data) =>
      db
        .insert(projectQuestions)
        .values({ projectId: pid, ...data, source: "hub" })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(projectQuestions)
        .set({ ...compact(data), updatedAt: new Date() })
        .where(
          and(eq(projectQuestions.id, itemId), eq(projectQuestions.projectId, pid))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(projectQuestions)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(projectQuestions.id, itemId), eq(projectQuestions.projectId, pid))
        )
        .returning({ id: projectQuestions.id })
        .then((r) => r.length > 0),
  }),

  glossary: listDef({
    kind: "list",
    label: "Pojęcie",
    createSchema: glossaryCreate,
    patchSchema: glossaryPatch,
    list: (pid) =>
      db
        .select()
        .from(projectGlossary)
        .where(
          and(eq(projectGlossary.projectId, pid), isNull(projectGlossary.deletedAt))
        )
        .orderBy(asc(projectGlossary.orderIdx), asc(projectGlossary.term)),
    create: (pid, data) =>
      db
        .insert(projectGlossary)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(projectGlossary)
        .set(compact(data))
        .where(
          and(eq(projectGlossary.id, itemId), eq(projectGlossary.projectId, pid))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(projectGlossary)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(projectGlossary.id, itemId), eq(projectGlossary.projectId, pid))
        )
        .returning({ id: projectGlossary.id })
        .then((r) => r.length > 0),
  }),

  credentials: listDef({
    kind: "list",
    label: "Dostęp",
    createSchema: credentialCreate,
    patchSchema: credentialPatch,
    list: (pid) =>
      db
        .select({
          id: projectCredentials.id,
          serviceName: projectCredentials.serviceName,
          url: projectCredentials.url,
          login: projectCredentials.login,
          category: projectCredentials.category,
          notes: projectCredentials.notes,
          // celowo NIE zwracamy encryptedSecret w listingu
          hasSecret: projectCredentials.encryptedSecret,
        })
        .from(projectCredentials)
        .where(
          and(
            eq(projectCredentials.projectId, pid),
            isNull(projectCredentials.deletedAt)
          )
        )
        .orderBy(asc(projectCredentials.serviceName))
        .then((rows) =>
          rows.map((r) => ({ ...r, hasSecret: Boolean(r.hasSecret) }))
        ),
    create: (pid, data) => {
      const { secret, url, ...rest } = data;
      return db
        .insert(projectCredentials)
        .values({
          projectId: pid,
          ...rest,
          url: url || null,
          encryptedSecret: secret ? encryptSecret(secret) : null,
        })
        .returning({ id: projectCredentials.id })
        .then((r) => r[0]);
    },
    update: (pid, itemId, data) => {
      const { secret, url, ...rest } = data;
      const patch: Row = compact(rest);
      if (url !== undefined) patch.url = url || null;
      if (secret !== undefined)
        patch.encryptedSecret = secret ? encryptSecret(secret) : null;
      return db
        .update(projectCredentials)
        .set(patch)
        .where(
          and(
            eq(projectCredentials.id, itemId),
            eq(projectCredentials.projectId, pid)
          )
        )
        .returning({ id: projectCredentials.id })
        .then((r) => r[0]);
    },
    softDelete: (pid, itemId) =>
      db
        .update(projectCredentials)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(projectCredentials.id, itemId),
            eq(projectCredentials.projectId, pid)
          )
        )
        .returning({ id: projectCredentials.id })
        .then((r) => r.length > 0),
  }),

  materials: listDef({
    kind: "list",
    label: "Materiał",
    createSchema: materialCreate,
    patchSchema: materialPatch,
    list: (pid) =>
      db
        .select()
        .from(projectMaterials)
        .where(
          and(eq(projectMaterials.projectId, pid), isNull(projectMaterials.deletedAt))
        )
        .orderBy(desc(projectMaterials.addedAt)),
    create: (pid, data) =>
      db
        .insert(projectMaterials)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(projectMaterials)
        .set(compact(data))
        .where(
          and(eq(projectMaterials.id, itemId), eq(projectMaterials.projectId, pid))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(projectMaterials)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(projectMaterials.id, itemId), eq(projectMaterials.projectId, pid))
        )
        .returning({ id: projectMaterials.id })
        .then((r) => r.length > 0),
  }),

  notes: listDef({
    kind: "list",
    label: "Notatka",
    createSchema: noteCreate,
    patchSchema: notePatch,
    list: (pid) =>
      db
        .select()
        .from(projectNotes)
        .where(and(eq(projectNotes.projectId, pid), isNull(projectNotes.deletedAt)))
        .orderBy(desc(projectNotes.createdAt)),
    create: (pid, data) =>
      db
        .insert(projectNotes)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(projectNotes)
        .set(compact(data))
        .where(and(eq(projectNotes.id, itemId), eq(projectNotes.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(projectNotes)
        .set({ deletedAt: new Date() })
        .where(and(eq(projectNotes.id, itemId), eq(projectNotes.projectId, pid)))
        .returning({ id: projectNotes.id })
        .then((r) => r.length > 0),
  }),

  tasks: listDef({
    kind: "list",
    label: "Zadanie",
    createSchema: taskCreate,
    patchSchema: taskPatch,
    list: (pid) =>
      db
        .select()
        .from(projectTasks)
        .where(and(eq(projectTasks.projectId, pid), isNull(projectTasks.deletedAt)))
        .orderBy(asc(projectTasks.orderIdx), asc(projectTasks.createdAt)),
    create: (pid, data) =>
      db
        .insert(projectTasks)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(projectTasks)
        .set({ ...compact(data), updatedAt: new Date() })
        .where(and(eq(projectTasks.id, itemId), eq(projectTasks.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(projectTasks)
        .set({ deletedAt: new Date() })
        .where(and(eq(projectTasks.id, itemId), eq(projectTasks.projectId, pid)))
        .returning({ id: projectTasks.id })
        .then((r) => r.length > 0),
  }),

  segments: listDef({
    kind: "list",
    label: "Segment",
    createSchema: segmentCreate,
    patchSchema: segmentPatch,
    list: (pid) =>
      db
        .select()
        .from(segments)
        .where(and(eq(segments.projectId, pid), isNull(segments.deletedAt)))
        .orderBy(asc(segments.orderIdx), asc(segments.name)),
    create: (pid, data) =>
      db
        .insert(segments)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(segments)
        .set(compact(data))
        .where(and(eq(segments.id, itemId), eq(segments.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(segments)
        .set({ deletedAt: new Date() })
        .where(and(eq(segments.id, itemId), eq(segments.projectId, pid)))
        .returning({ id: segments.id })
        .then((r) => r.length > 0),
  }),

  channels: listDef({
    kind: "list",
    label: "Kanał",
    createSchema: channelCreate,
    patchSchema: channelPatch,
    list: (pid) =>
      db
        .select()
        .from(channels)
        .where(and(eq(channels.projectId, pid), isNull(channels.deletedAt)))
        .orderBy(asc(channels.name)),
    create: (pid, data) =>
      db
        .insert(channels)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(channels)
        .set(compact(data))
        .where(and(eq(channels.id, itemId), eq(channels.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(channels)
        .set({ deletedAt: new Date() })
        .where(and(eq(channels.id, itemId), eq(channels.projectId, pid)))
        .returning({ id: channels.id })
        .then((r) => r.length > 0),
  }),

  // Plan aktywności jest scoped po channelId, ale wystawiamy go project-wide
  // (join przez channels) — dzięki temu nie potrzeba osobnych folderów route.
  "channel-activity-plan": listDef({
    kind: "list",
    label: "Aktywność kanału",
    createSchema: activityCreate,
    patchSchema: activityPatch,
    list: (pid) =>
      db
        .select({
          id: channelActivityPlan.id,
          channelId: channelActivityPlan.channelId,
          channelName: channels.name,
          segmentId: channelActivityPlan.segmentId,
          stage: channelActivityPlan.stage,
          whatToPublishMd: channelActivityPlan.whatToPublishMd,
          cadence: channelActivityPlan.cadence,
          weeklyCount: channelActivityPlan.weeklyCount,
          monthlyBudget: channelActivityPlan.monthlyBudget,
          priority: channelActivityPlan.priority,
          notesMd: channelActivityPlan.notesMd,
          orderIdx: channelActivityPlan.orderIdx,
        })
        .from(channelActivityPlan)
        .innerJoin(channels, eq(channelActivityPlan.channelId, channels.id))
        .where(
          and(
            eq(channels.projectId, pid),
            isNull(channelActivityPlan.deletedAt)
          )
        )
        .orderBy(asc(channelActivityPlan.orderIdx)),
    create: (_pid, data) =>
      db
        .insert(channelActivityPlan)
        .values({ ...data })
        .returning()
        .then((r) => r[0]),
    update: (_pid, itemId, data) =>
      db
        .update(channelActivityPlan)
        .set(compact(data))
        .where(eq(channelActivityPlan.id, itemId))
        .returning()
        .then((r) => r[0]),
    softDelete: (_pid, itemId) =>
      db
        .update(channelActivityPlan)
        .set({ deletedAt: new Date() })
        .where(eq(channelActivityPlan.id, itemId))
        .returning({ id: channelActivityPlan.id })
        .then((r) => r.length > 0),
  }),

  "sales-pitches": listDef({
    kind: "list",
    label: "Pitch sprzedażowy",
    createSchema: pitchCreate,
    patchSchema: pitchPatch,
    list: (pid) =>
      db
        .select()
        .from(salesPitches)
        .where(and(eq(salesPitches.projectId, pid), isNull(salesPitches.deletedAt)))
        .orderBy(asc(salesPitches.orderIdx), asc(salesPitches.createdAt)),
    create: (pid, data) =>
      db
        .insert(salesPitches)
        .values({ projectId: pid, ...data, source: "hub" })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(salesPitches)
        .set({ ...compact(data), updatedAt: new Date() })
        .where(and(eq(salesPitches.id, itemId), eq(salesPitches.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(salesPitches)
        .set({ deletedAt: new Date() })
        .where(and(eq(salesPitches.id, itemId), eq(salesPitches.projectId, pid)))
        .returning({ id: salesPitches.id })
        .then((r) => r.length > 0),
  }),

  "sales-scripts": listDef({
    kind: "list",
    label: "Skrypt sprzedażowy",
    createSchema: scriptCreate,
    patchSchema: scriptPatch,
    list: (pid) =>
      db
        .select()
        .from(salesScripts)
        .where(and(eq(salesScripts.projectId, pid), isNull(salesScripts.deletedAt)))
        .orderBy(asc(salesScripts.orderIdx), asc(salesScripts.createdAt)),
    create: (pid, data) =>
      db
        .insert(salesScripts)
        .values({ projectId: pid, ...data, source: "hub" })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(salesScripts)
        .set({ ...compact(data), updatedAt: new Date() })
        .where(and(eq(salesScripts.id, itemId), eq(salesScripts.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(salesScripts)
        .set({ deletedAt: new Date() })
        .where(and(eq(salesScripts.id, itemId), eq(salesScripts.projectId, pid)))
        .returning({ id: salesScripts.id })
        .then((r) => r.length > 0),
  }),

  "lead-magnets": listDef({
    kind: "list",
    label: "Lead magnet",
    createSchema: leadMagnetCreate,
    patchSchema: leadMagnetPatch,
    list: (pid) =>
      db
        .select()
        .from(leadMagnets)
        .where(and(eq(leadMagnets.projectId, pid), isNull(leadMagnets.deletedAt)))
        .orderBy(asc(leadMagnets.orderIdx), asc(leadMagnets.name)),
    create: (pid, data) =>
      db
        .insert(leadMagnets)
        .values({ projectId: pid, ...data, source: "hub" })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(leadMagnets)
        .set(compact(data))
        .where(and(eq(leadMagnets.id, itemId), eq(leadMagnets.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(leadMagnets)
        .set({ deletedAt: new Date() })
        .where(and(eq(leadMagnets.id, itemId), eq(leadMagnets.projectId, pid)))
        .returning({ id: leadMagnets.id })
        .then((r) => r.length > 0),
  }),

  "nav-items": listDef({
    kind: "list",
    label: "Pozycja nawigacji",
    createSchema: navItemCreate,
    patchSchema: navItemPatch,
    list: (pid) =>
      db
        .select()
        .from(navItems)
        .where(and(eq(navItems.projectId, pid), isNull(navItems.deletedAt)))
        .orderBy(asc(navItems.orderIdx), asc(navItems.label)),
    create: (pid, data) =>
      db
        .insert(navItems)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(navItems)
        .set(compact(data))
        .where(and(eq(navItems.id, itemId), eq(navItems.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(navItems)
        .set({ deletedAt: new Date() })
        .where(and(eq(navItems.id, itemId), eq(navItems.projectId, pid)))
        .returning({ id: navItems.id })
        .then((r) => r.length > 0),
  }),

  "site-maintenance-costs": listDef({
    kind: "list",
    label: "Koszt utrzymania",
    createSchema: maintenanceCreate,
    patchSchema: maintenancePatch,
    list: (pid) =>
      db
        .select()
        .from(siteMaintenanceCosts)
        .where(
          and(
            eq(siteMaintenanceCosts.projectId, pid),
            isNull(siteMaintenanceCosts.deletedAt)
          )
        )
        .orderBy(asc(siteMaintenanceCosts.item)),
    create: (pid, data) =>
      db
        .insert(siteMaintenanceCosts)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(siteMaintenanceCosts)
        .set(compact(data))
        .where(
          and(
            eq(siteMaintenanceCosts.id, itemId),
            eq(siteMaintenanceCosts.projectId, pid)
          )
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(siteMaintenanceCosts)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(siteMaintenanceCosts.id, itemId),
            eq(siteMaintenanceCosts.projectId, pid)
          )
        )
        .returning({ id: siteMaintenanceCosts.id })
        .then((r) => r.length > 0),
  }),

  "site-audits": listDef({
    kind: "list",
    label: "Audyt",
    createSchema: auditCreate,
    patchSchema: auditPatch,
    list: (pid) =>
      db
        .select()
        .from(siteAudits)
        .where(and(eq(siteAudits.projectId, pid), isNull(siteAudits.deletedAt)))
        .orderBy(desc(siteAudits.date)),
    create: (pid, data) =>
      db
        .insert(siteAudits)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(siteAudits)
        .set(compact(data))
        .where(and(eq(siteAudits.id, itemId), eq(siteAudits.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(siteAudits)
        .set({ deletedAt: new Date() })
        .where(and(eq(siteAudits.id, itemId), eq(siteAudits.projectId, pid)))
        .returning({ id: siteAudits.id })
        .then((r) => r.length > 0),
  }),

  kpis: listDef({
    kind: "list",
    label: "KPI",
    createSchema: kpiCreate,
    patchSchema: kpiPatch,
    list: (pid) =>
      db
        .select()
        .from(kpis)
        .where(and(eq(kpis.projectId, pid), isNull(kpis.deletedAt)))
        .orderBy(asc(kpis.category), asc(kpis.name)),
    create: (pid, data) =>
      db
        .insert(kpis)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(kpis)
        .set(compact(data))
        .where(and(eq(kpis.id, itemId), eq(kpis.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(kpis)
        .set({ deletedAt: new Date() })
        .where(and(eq(kpis.id, itemId), eq(kpis.projectId, pid)))
        .returning({ id: kpis.id })
        .then((r) => r.length > 0),
  }),
};

// ─── Dzieci KPI (snapshoty, scoped po kpiId) ─────────────────────────────────

const kpiChildEntities: Record<string, ListEntityDef> = {
  snapshots: listDef({
    kind: "list",
    label: "Pomiar KPI",
    createSchema: snapshotCreate,
    patchSchema: snapshotPatch,
    list: (kpiId) =>
      db
        .select()
        .from(kpiSnapshots)
        .where(
          and(eq(kpiSnapshots.kpiId, kpiId), isNull(kpiSnapshots.deletedAt))
        )
        .orderBy(asc(kpiSnapshots.recordedAt)),
    create: (kpiId, data) =>
      db
        .insert(kpiSnapshots)
        .values({ kpiId, ...data })
        .returning()
        .then((r) => r[0]),
    update: (kpiId, itemId, data) =>
      db
        .update(kpiSnapshots)
        .set(compact(data))
        .where(
          and(eq(kpiSnapshots.id, itemId), eq(kpiSnapshots.kpiId, kpiId))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (kpiId, itemId) =>
      db
        .update(kpiSnapshots)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(kpiSnapshots.id, itemId), eq(kpiSnapshots.kpiId, kpiId))
        )
        .returning({ id: kpiSnapshots.id })
        .then((r) => r.length > 0),
  }),
};

// ─── Dzieci strony (scoped po pageId) ────────────────────────────────────────

const pageChildEntities: Record<string, ListEntityDef> = {
  sections: listDef({
    kind: "list",
    label: "Sekcja strony",
    createSchema: pageSectionCreate,
    patchSchema: pageSectionPatch,
    list: (pageId) =>
      db
        .select()
        .from(pageSections)
        .where(
          and(eq(pageSections.pageId, pageId), isNull(pageSections.deletedAt))
        )
        .orderBy(asc(pageSections.orderIdx)),
    create: (pageId, data) =>
      db
        .insert(pageSections)
        .values({ pageId, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pageId, itemId, data) =>
      db
        .update(pageSections)
        .set(compact(data))
        .where(
          and(eq(pageSections.id, itemId), eq(pageSections.pageId, pageId))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pageId, itemId) =>
      db
        .update(pageSections)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(pageSections.id, itemId), eq(pageSections.pageId, pageId))
        )
        .returning({ id: pageSections.id })
        .then((r) => r.length > 0),
  }),
};

// ─── Dzieci audytu (scoped po auditId) ───────────────────────────────────────

const auditChildEntities: Record<string, ListEntityDef> = {
  findings: listDef({
    kind: "list",
    label: "Ustalenie audytu",
    createSchema: findingCreate,
    patchSchema: findingPatch,
    list: (auditId) =>
      db
        .select()
        .from(siteAuditFindings)
        .where(
          and(
            eq(siteAuditFindings.auditId, auditId),
            isNull(siteAuditFindings.deletedAt)
          )
        )
        .orderBy(asc(siteAuditFindings.orderIdx)),
    create: (auditId, data) =>
      db
        .insert(siteAuditFindings)
        .values({ auditId, ...data })
        .returning()
        .then((r) => r[0]),
    update: (auditId, itemId, data) =>
      db
        .update(siteAuditFindings)
        .set(compact(data))
        .where(
          and(
            eq(siteAuditFindings.id, itemId),
            eq(siteAuditFindings.auditId, auditId)
          )
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (auditId, itemId) =>
      db
        .update(siteAuditFindings)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(siteAuditFindings.id, itemId),
            eq(siteAuditFindings.auditId, auditId)
          )
        )
        .returning({ id: siteAuditFindings.id })
        .then((r) => r.length > 0),
  }),
};

// ─── Rejestr dzieci segmentu (scoped po segmentId) ───────────────────────────
// Pierwszy argument closures = segmentId (nie projectId).

const segmentChildEntities: Record<string, ListEntityDef> = {
  "buyer-journey": listDef({
    kind: "list",
    label: "Etap podróży",
    createSchema: buyerStageCreate,
    patchSchema: buyerStagePatch,
    list: (sid) =>
      db
        .select()
        .from(buyerJourneyStages)
        .where(
          and(
            eq(buyerJourneyStages.segmentId, sid),
            isNull(buyerJourneyStages.deletedAt)
          )
        )
        .orderBy(asc(buyerJourneyStages.orderIdx)),
    create: (sid, data) =>
      db
        .insert(buyerJourneyStages)
        .values({ segmentId: sid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (sid, itemId, data) =>
      db
        .update(buyerJourneyStages)
        .set(compact(data))
        .where(
          and(
            eq(buyerJourneyStages.id, itemId),
            eq(buyerJourneyStages.segmentId, sid)
          )
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (sid, itemId) =>
      db
        .update(buyerJourneyStages)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(buyerJourneyStages.id, itemId),
            eq(buyerJourneyStages.segmentId, sid)
          )
        )
        .returning({ id: buyerJourneyStages.id })
        .then((r) => r.length > 0),
  }),

  "quick-wins": listDef({
    kind: "list",
    label: "Quick win",
    createSchema: quickWinCreate,
    patchSchema: quickWinPatch,
    list: (sid) =>
      db
        .select()
        .from(segmentQuickWins)
        .where(
          and(
            eq(segmentQuickWins.segmentId, sid),
            isNull(segmentQuickWins.deletedAt)
          )
        )
        .orderBy(asc(segmentQuickWins.orderIdx)),
    create: (sid, data) =>
      db
        .insert(segmentQuickWins)
        .values({ segmentId: sid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (sid, itemId, data) =>
      db
        .update(segmentQuickWins)
        .set(compact(data))
        .where(
          and(
            eq(segmentQuickWins.id, itemId),
            eq(segmentQuickWins.segmentId, sid)
          )
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (sid, itemId) =>
      db
        .update(segmentQuickWins)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(segmentQuickWins.id, itemId),
            eq(segmentQuickWins.segmentId, sid)
          )
        )
        .returning({ id: segmentQuickWins.id })
        .then((r) => r.length > 0),
  }),

  risks: listDef({
    kind: "list",
    label: "Ryzyko",
    createSchema: riskCreate,
    patchSchema: riskPatch,
    list: (sid) =>
      db
        .select()
        .from(segmentRisks)
        .where(
          and(eq(segmentRisks.segmentId, sid), isNull(segmentRisks.deletedAt))
        )
        .orderBy(asc(segmentRisks.orderIdx)),
    create: (sid, data) =>
      db
        .insert(segmentRisks)
        .values({ segmentId: sid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (sid, itemId, data) =>
      db
        .update(segmentRisks)
        .set(compact(data))
        .where(
          and(eq(segmentRisks.id, itemId), eq(segmentRisks.segmentId, sid))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (sid, itemId) =>
      db
        .update(segmentRisks)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(segmentRisks.id, itemId), eq(segmentRisks.segmentId, sid))
        )
        .returning({ id: segmentRisks.id })
        .then((r) => r.length > 0),
  }),
};

// ─── Marka: schematy ─────────────────────────────────────────────────────────

const brandIdentityPatch = z.object({
  missionMd: md(),
  visionMd: md(),
  purposeMd: md(),
  brandPillarsMd: md(),
  toneOfVoiceMd: md(),
  brandPersonalityMd: md(),
});

const logoItem = z.object({
  label: z.string(),
  url: z.string(),
  kind: z.string().optional(),
});
const colorItem = z.object({
  name: z.string(),
  value: z.string(),
  role: z.string().optional(),
});
const typeItem = z.object({
  role: z.string(),
  family: z.string(),
  weights: z.string().optional(),
  url: z.string().optional(),
});

const brandVisualPatch = z.object({
  brandbookUrl: md(),
  usageGuidelinesMd: md(),
  logoFiles: z.array(logoItem).nullable().optional(),
  colors: z.array(colorItem).nullable().optional(),
  typography: z.array(typeItem).nullable().optional(),
});

// ─── Biznes: kryteria segmentacji ────────────────────────────────────────────

const dimensionItem = z.object({
  dimension: z.string(),
  description: z.string().optional(),
  values: z.array(z.string()).optional(),
});
const marketSegPatch = z.object({
  dimensions: z.array(dimensionItem).nullable().optional(),
  notesMd: md(),
});

// ─── Rejestr encji singletonowych ────────────────────────────────────────────

const singletonEntities: Record<string, SingletonEntityDef> = {
  "market-segmentation": singletonDef({
    kind: "singleton",
    label: "Kryteria segmentacji",
    patchSchema: marketSegPatch,
    get: (pid) =>
      db
        .select()
        .from(marketSegmentationCriteria)
        .where(eq(marketSegmentationCriteria.projectId, pid))
        .limit(1)
        .then((r) => r[0]),
    upsert: (pid, data) =>
      db
        .insert(marketSegmentationCriteria)
        .values({ projectId: pid, ...data })
        .onConflictDoUpdate({
          target: marketSegmentationCriteria.projectId,
          set: { ...compact(data), updatedAt: new Date() },
        })
        .returning()
        .then((r) => r[0]),
  }),

  "brand-identity": singletonDef({
    kind: "singleton",
    label: "Tożsamość marki",
    patchSchema: brandIdentityPatch,
    get: (pid) =>
      db
        .select()
        .from(brandIdentity)
        .where(eq(brandIdentity.projectId, pid))
        .limit(1)
        .then((r) => r[0]),
    upsert: (pid, data) =>
      db
        .insert(brandIdentity)
        .values({ projectId: pid, ...data })
        .onConflictDoUpdate({
          target: brandIdentity.projectId,
          set: { ...compact(data), updatedAt: new Date() },
        })
        .returning()
        .then((r) => r[0]),
  }),

  "brand-visual": singletonDef({
    kind: "singleton",
    label: "Identyfikacja wizualna",
    patchSchema: brandVisualPatch,
    get: (pid) =>
      db
        .select()
        .from(brandVisual)
        .where(eq(brandVisual.projectId, pid))
        .limit(1)
        .then((r) => r[0]),
    upsert: (pid, data) =>
      db
        .insert(brandVisual)
        .values({ projectId: pid, ...data })
        .onConflictDoUpdate({
          target: brandVisual.projectId,
          set: { ...compact(data), updatedAt: new Date() },
        })
        .returning()
        .then((r) => r[0]),
  }),

  "copy-guidelines": singletonDef({
    kind: "singleton",
    label: "Wytyczne copy",
    patchSchema: copyGuidelinesPatch,
    get: (pid) =>
      db
        .select()
        .from(copyGuidelines)
        .where(eq(copyGuidelines.projectId, pid))
        .limit(1)
        .then((r) => r[0]),
    upsert: (pid, data) =>
      db
        .insert(copyGuidelines)
        .values({ projectId: pid, ...data })
        .onConflictDoUpdate({
          target: copyGuidelines.projectId,
          set: { ...compact(data), updatedAt: new Date() },
        })
        .returning()
        .then((r) => r[0]),
  }),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function getListEntity(key: string): ListEntityDef | undefined {
  return listEntities[key];
}

export function getSingletonEntity(key: string): SingletonEntityDef | undefined {
  return singletonEntities[key];
}

export function getSegmentChild(key: string): ListEntityDef | undefined {
  return segmentChildEntities[key];
}

export function getPageChild(key: string): ListEntityDef | undefined {
  return pageChildEntities[key];
}

export function getAuditChild(key: string): ListEntityDef | undefined {
  return auditChildEntities[key];
}

export function getKpiChild(key: string): ListEntityDef | undefined {
  return kpiChildEntities[key];
}

export function registerListEntities(entries: Record<string, ListEntityDef>) {
  Object.assign(listEntities, entries);
}
export function registerSingletonEntities(
  entries: Record<string, SingletonEntityDef>
) {
  Object.assign(singletonEntities, entries);
}

export const listEntityKeys = () => Object.keys(listEntities);
export const singletonEntityKeys = () => Object.keys(singletonEntities);
