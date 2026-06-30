import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  strategicDecisions,
  entityComments,
  campaigns,
  geoAssets,
  geoQueries,
  offers,
} from "@/db/schema";
import { registerListEntities, type ListEntityDef } from "./registry";

const md = () => z.string().nullable().optional();

function listDef<C, P>(d: ListEntityDef<C, P>): ListEntityDef {
  return d as unknown as ListEntityDef;
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function pathFilter<T extends { pathId: unknown }>(
  table: T,
  pathId: string | null | undefined
) {
  if (!pathId) return undefined;
  return or(
    eq(table.pathId as Parameters<typeof eq>[0], pathId),
    isNull(table.pathId as Parameters<typeof isNull>[0])
  );
}

function siteFilter<T extends { siteId: unknown }>(
  table: T,
  siteId: string | null | undefined
) {
  if (!siteId) return undefined;
  return eq(table.siteId as Parameters<typeof eq>[0], siteId);
}

const decisionCreate = z.object({
  title: z.string().min(1).max(255),
  pathId: z.string().uuid().nullable().optional(),
  reasonMd: md(),
  evidenceMd: md(),
  status: z.enum(["active", "revised", "withdrawn"]).optional(),
  authorType: z.enum(["human", "ai"]).optional(),
});
const decisionPatch = decisionCreate.partial();

const campaignCreate = z.object({
  name: z.string().min(1).max(255),
  pathId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  landingPageId: z.string().uuid().nullable().optional(),
  goal: md(),
  stage: z.enum(["TOFU", "MOFU", "BOFU", "retention"]).nullable().optional(),
  channels: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  budgetPlan: z.number().int().nullable().optional(),
  budgetSpent: z.number().int().nullable().optional(),
  periodStart: z.coerce.date().nullable().optional(),
  periodEnd: z.coerce.date().nullable().optional(),
  creatives: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  utm: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
});
const campaignPatch = campaignCreate.partial();

const geoAssetCreate = z.object({
  siteId: z.string().uuid().nullable().optional(),
  pageId: z.string().uuid().nullable().optional(),
  type: z.string().min(1).max(50),
  checklist: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  notesMd: md(),
});
const geoAssetPatch = geoAssetCreate.partial();

const geoQueryCreate = z.object({
  targetPageId: z.string().uuid().nullable().optional(),
  query: z.string().min(1),
  intent: z.string().max(100).nullable().optional(),
  stage: z.enum(["TOFU", "MOFU", "BOFU", "retention"]).nullable().optional(),
  citationStatus: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
});
const geoQueryPatch = geoQueryCreate.partial();

const offerCreate = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["product", "service", "package"]).optional(),
  pricingMd: md(),
  uvpMd: md(),
  status: z.string().max(50).nullable().optional(),
  orderIdx: z.number().int().optional(),
});
const offerPatch = offerCreate.partial();

const commentCreate = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  authorType: z.enum(["team", "client", "ai"]).optional(),
  authorName: z.string().max(255).nullable().optional(),
  body: z.string().min(1),
  mentions: z.array(z.string()).nullable().optional(),
});
const commentPatch = z.object({
  body: z.string().min(1).optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
});

registerListEntities({
  decisions: listDef({
    kind: "list",
    label: "Decyzja strategiczna",
    supportsPath: true,
    createSchema: decisionCreate,
    patchSchema: decisionPatch,
    list: (pid, pathId) => {
      const pf = pathFilter(strategicDecisions, pathId);
      return db
        .select()
        .from(strategicDecisions)
        .where(
          and(
            eq(strategicDecisions.projectId, pid),
            isNull(strategicDecisions.deletedAt),
            pf
          )
        )
        .orderBy(desc(strategicDecisions.createdAt));
    },
    create: (pid, data) =>
      db
        .insert(strategicDecisions)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(strategicDecisions)
        .set({ ...compact(data), updatedAt: new Date() })
        .where(
          and(
            eq(strategicDecisions.id, itemId),
            eq(strategicDecisions.projectId, pid)
          )
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(strategicDecisions)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(strategicDecisions.id, itemId),
            eq(strategicDecisions.projectId, pid)
          )
        )
        .returning({ id: strategicDecisions.id })
        .then((r) => r.length > 0),
  }),

  campaigns: listDef({
    kind: "list",
    label: "Kampania",
    supportsPath: true,
    createSchema: campaignCreate,
    patchSchema: campaignPatch,
    list: (pid, pathId) => {
      const pf = pathFilter(campaigns, pathId);
      return db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.projectId, pid), isNull(campaigns.deletedAt), pf)
        )
        .orderBy(asc(campaigns.name));
    },
    create: (pid, data) =>
      db
        .insert(campaigns)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(campaigns)
        .set(compact(data))
        .where(and(eq(campaigns.id, itemId), eq(campaigns.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(campaigns)
        .set({ deletedAt: new Date() })
        .where(and(eq(campaigns.id, itemId), eq(campaigns.projectId, pid)))
        .returning({ id: campaigns.id })
        .then((r) => r.length > 0),
  }),

  "geo-assets": listDef({
    kind: "list",
    label: "Asset GEO",
    createSchema: geoAssetCreate,
    patchSchema: geoAssetPatch,
    list: (pid, _pathId, siteId) => {
      const sf = siteFilter(geoAssets, siteId);
      return db
        .select()
        .from(geoAssets)
        .where(
          and(eq(geoAssets.projectId, pid), isNull(geoAssets.deletedAt), sf)
        )
        .orderBy(asc(geoAssets.type));
    },
    create: (pid, data) =>
      db
        .insert(geoAssets)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(geoAssets)
        .set(compact(data))
        .where(and(eq(geoAssets.id, itemId), eq(geoAssets.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(geoAssets)
        .set({ deletedAt: new Date() })
        .where(and(eq(geoAssets.id, itemId), eq(geoAssets.projectId, pid)))
        .returning({ id: geoAssets.id })
        .then((r) => r.length > 0),
  }),

  "geo-queries": listDef({
    kind: "list",
    label: "Zapytanie GEO",
    createSchema: geoQueryCreate,
    patchSchema: geoQueryPatch,
    list: (pid) =>
      db
        .select()
        .from(geoQueries)
        .where(
          and(eq(geoQueries.projectId, pid), isNull(geoQueries.deletedAt))
        )
        .orderBy(asc(geoQueries.query)),
    create: (pid, data) =>
      db
        .insert(geoQueries)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(geoQueries)
        .set(compact(data))
        .where(and(eq(geoQueries.id, itemId), eq(geoQueries.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(geoQueries)
        .set({ deletedAt: new Date() })
        .where(and(eq(geoQueries.id, itemId), eq(geoQueries.projectId, pid)))
        .returning({ id: geoQueries.id })
        .then((r) => r.length > 0),
  }),

  offers: listDef({
    kind: "list",
    label: "Oferta",
    createSchema: offerCreate,
    patchSchema: offerPatch,
    list: (pid) =>
      db
        .select()
        .from(offers)
        .where(and(eq(offers.projectId, pid), isNull(offers.deletedAt)))
        .orderBy(asc(offers.orderIdx), asc(offers.name)),
    create: (pid, data) =>
      db
        .insert(offers)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(offers)
        .set(compact(data))
        .where(and(eq(offers.id, itemId), eq(offers.projectId, pid)))
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(offers)
        .set({ deletedAt: new Date() })
        .where(and(eq(offers.id, itemId), eq(offers.projectId, pid)))
        .returning({ id: offers.id })
        .then((r) => r.length > 0),
  }),

  comments: listDef({
    kind: "list",
    label: "Komentarz",
    createSchema: commentCreate,
    patchSchema: commentPatch,
    list: (pid) =>
      db
        .select()
        .from(entityComments)
        .where(
          and(eq(entityComments.projectId, pid), isNull(entityComments.deletedAt))
        )
        .orderBy(desc(entityComments.createdAt)),
    create: (pid, data) =>
      db
        .insert(entityComments)
        .values({ projectId: pid, ...data })
        .returning()
        .then((r) => r[0]),
    update: (pid, itemId, data) =>
      db
        .update(entityComments)
        .set(compact(data))
        .where(
          and(eq(entityComments.id, itemId), eq(entityComments.projectId, pid))
        )
        .returning()
        .then((r) => r[0]),
    softDelete: (pid, itemId) =>
      db
        .update(entityComments)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(entityComments.id, itemId), eq(entityComments.projectId, pid))
        )
        .returning({ id: entityComments.id })
        .then((r) => r.length > 0),
  }),
});

/** Komentarze filtrowane po encji (używane przez API). */
export async function listEntityComments(
  projectId: string,
  entityType: string,
  entityId: string
) {
  return db
    .select()
    .from(entityComments)
    .where(
      and(
        eq(entityComments.projectId, projectId),
        eq(entityComments.entityType, entityType),
        eq(entityComments.entityId, entityId),
        isNull(entityComments.deletedAt)
      )
    )
    .orderBy(asc(entityComments.createdAt));
}
