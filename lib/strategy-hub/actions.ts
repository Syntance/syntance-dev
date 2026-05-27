"use server";

import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  userFlows,
  kpis,
  channels,
  pages,
  seoKeywords,
  techStack,
  hostingServices,
  domains,
  clientResources,
  notionSyncLog,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Segments ────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  persona: z.string().optional(),
  jtbd: z.string().optional(),
  problem: z.string().optional(),
  uvpText: z.string().optional(),
  priority: z.coerce.number().int().optional(),
});

export async function upsertSegment(
  data: z.infer<typeof segmentSchema> & { id?: string }
) {
  const parsed = segmentSchema.parse(data);
  if (data.id) {
    await db.update(segments).set(parsed).where(eq(segments.id, data.id));
  } else {
    await db.insert(segments).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/marketing`);
}

export async function deleteSegment(id: string, projectId: string) {
  await db
    .update(segments)
    .set({ deletedAt: new Date() })
    .where(eq(segments.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

// ─── Purchase stages ─────────────────────────────────────────────────────────

const stageSchema = z.object({
  segmentId: z.string().uuid(),
  name: z.string().min(1),
  phase: z.string().optional(),
  orderIdx: z.coerce.number().int().optional(),
  trigger: z.string().optional(),
  objections: z.string().optional(),
  emotionalState: z.string().optional(),
  questions: z.string().optional(),
});

export async function upsertStage(
  data: z.infer<typeof stageSchema> & { id?: string; projectId: string }
) {
  const { projectId, id, ...rest } = data;
  const parsed = stageSchema.parse(rest);
  if (id) {
    await db.update(purchaseStages).set(parsed).where(eq(purchaseStages.id, id));
  } else {
    await db.insert(purchaseStages).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

export async function deleteStage(id: string, projectId: string) {
  await db
    .update(purchaseStages)
    .set({ deletedAt: new Date() })
    .where(eq(purchaseStages.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

// ─── Funnel elements ─────────────────────────────────────────────────────────

const funnelElementSchema = z.object({
  stageId: z.string().uuid(),
  segmentId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  position: z.coerce.number().int().default(0),
  contentMd: z.string().optional(),
  cta: z.string().optional(),
  ctaUrl: z.string().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
});

export async function upsertFunnelElement(
  data: z.infer<typeof funnelElementSchema> & {
    id?: string;
    projectId: string;
  }
) {
  const { projectId, id, ...rest } = data;
  const parsed = funnelElementSchema.parse(rest);
  if (id) {
    await db.update(funnelElements).set(parsed).where(eq(funnelElements.id, id));
  } else {
    await db.insert(funnelElements).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

export async function deleteFunnelElement(id: string, projectId: string) {
  await db
    .update(funnelElements)
    .set({ deletedAt: new Date() })
    .where(eq(funnelElements.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

const kpiSchema = z.object({
  projectId: z.string().uuid(),
  segmentId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  target: z.string().optional(),
  actual: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
});

export async function upsertKpi(
  data: z.infer<typeof kpiSchema> & { id?: string }
) {
  const parsed = kpiSchema.parse(data);
  const insertData = {
    ...parsed,
    segmentId: parsed.segmentId || null,
  };
  if (data.id) {
    await db.update(kpis).set(insertData).where(eq(kpis.id, data.id));
  } else {
    await db.insert(kpis).values(insertData);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/marketing`);
}

export async function deleteKpi(id: string, projectId: string) {
  await db.update(kpis).set({ deletedAt: new Date() }).where(eq(kpis.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

// ─── User flows ──────────────────────────────────────────────────────────────

const userFlowSchema = z.object({
  projectId: z.string().uuid(),
  segmentId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  stepsMd: z.string().optional(),
  conversionGoal: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

export async function upsertUserFlow(
  data: z.infer<typeof userFlowSchema> & { id?: string }
) {
  const parsed = userFlowSchema.parse(data);
  const insertData = {
    ...parsed,
    segmentId: parsed.segmentId || null,
  };
  if (data.id) {
    await db.update(userFlows).set(insertData).where(eq(userFlows.id, data.id));
  } else {
    await db.insert(userFlows).values(insertData);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/marketing`);
}

export async function deleteUserFlow(id: string, projectId: string) {
  await db
    .update(userFlows)
    .set({ deletedAt: new Date() })
    .where(eq(userFlows.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/marketing`);
}

// ─── Pages ───────────────────────────────────────────────────────────────────

const pageSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  urlPath: z.string().optional(),
  type: z.string().optional(),
  roleInFunnel: z.string().optional(),
  cta: z.string().optional(),
  goal: z.string().optional(),
  status: z.string().optional(),
  priority: z.coerce.number().int().optional(),
});

export async function upsertPage(
  data: z.infer<typeof pageSchema> & { id?: string }
) {
  const parsed = pageSchema.parse(data);
  if (data.id) {
    await db.update(pages).set(parsed).where(eq(pages.id, data.id));
  } else {
    await db.insert(pages).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/website`);
}

export async function deletePage(id: string, projectId: string) {
  await db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/website`);
}

// ─── SEO keywords ────────────────────────────────────────────────────────────

const seoSchema = z.object({
  projectId: z.string().uuid(),
  phrase: z.string().min(1),
  intent: z.string().optional(),
  volume: z.coerce.number().int().optional().nullable(),
  difficulty: z.coerce.number().int().optional().nullable(),
  priority: z.coerce.number().int().optional(),
  funnelStage: z.string().optional(),
  status: z.string().optional(),
});

export async function upsertSeoKeyword(
  data: z.infer<typeof seoSchema> & { id?: string }
) {
  const parsed = seoSchema.parse(data);
  if (data.id) {
    await db.update(seoKeywords).set(parsed).where(eq(seoKeywords.id, data.id));
  } else {
    await db.insert(seoKeywords).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/website`);
}

export async function deleteSeoKeyword(id: string, projectId: string) {
  await db
    .update(seoKeywords)
    .set({ deletedAt: new Date() })
    .where(eq(seoKeywords.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/website`);
}

// ─── Tech stack ──────────────────────────────────────────────────────────────

const techSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().optional(),
  monthlyCost: z.coerce.number().int().optional().nullable(),
  yearlyCost: z.coerce.number().int().optional().nullable(),
  description: z.string().optional(),
  url: z.string().optional(),
  status: z.string().optional(),
});

export async function upsertTechStack(
  data: z.infer<typeof techSchema> & { id?: string }
) {
  const parsed = techSchema.parse(data);
  if (data.id) {
    await db.update(techStack).set(parsed).where(eq(techStack.id, data.id));
  } else {
    await db.insert(techStack).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/website`);
}

export async function deleteTechStack(id: string, projectId: string) {
  await db
    .update(techStack)
    .set({ deletedAt: new Date() })
    .where(eq(techStack.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/website`);
}

// ─── Hosting services ────────────────────────────────────────────────────────

const hostingSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().optional(),
  provider: z.string().optional(),
  url: z.string().optional(),
  status: z.string().optional(),
  monthlyCost: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional(),
});

export async function upsertHosting(
  data: z.infer<typeof hostingSchema> & { id?: string }
) {
  const parsed = hostingSchema.parse(data);
  if (data.id) {
    await db.update(hostingServices).set(parsed).where(eq(hostingServices.id, data.id));
  } else {
    await db.insert(hostingServices).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/admin`);
}

export async function deleteHosting(id: string, projectId: string) {
  await db.delete(hostingServices).where(eq(hostingServices.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/admin`);
}

// ─── Domains ─────────────────────────────────────────────────────────────────

const domainSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  registrar: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  sslStatus: z.string().optional(),
  dnsProvider: z.string().optional(),
});

export async function upsertDomain(
  data: z.infer<typeof domainSchema> & { id?: string }
) {
  const parsed = domainSchema.parse(data);
  const insertData = {
    ...parsed,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
  };
  if (data.id) {
    await db.update(domains).set(insertData).where(eq(domains.id, data.id));
  } else {
    await db.insert(domains).values(insertData);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/admin`);
}

export async function deleteDomain(id: string, projectId: string) {
  await db.delete(domains).where(eq(domains.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/admin`);
}

// ─── Client resources ────────────────────────────────────────────────────────

const resourceSchema = z.object({
  projectId: z.string().uuid(),
  label: z.string().min(1),
  url: z.string().min(1),
  category: z.string().optional(),
  icon: z.string().optional(),
  orderIdx: z.coerce.number().int().optional(),
});

export async function upsertResource(
  data: z.infer<typeof resourceSchema> & { id?: string }
) {
  const parsed = resourceSchema.parse(data);
  if (data.id) {
    await db.update(clientResources).set(parsed).where(eq(clientResources.id, data.id));
  } else {
    await db.insert(clientResources).values(parsed);
  }
  revalidatePath(`/strategy-hub/projects/${parsed.projectId}/admin`);
}

export async function deleteResource(id: string, projectId: string) {
  await db.delete(clientResources).where(eq(clientResources.id, id));
  revalidatePath(`/strategy-hub/projects/${projectId}/admin`);
}

// ─── Suppress unused warnings on imports ─────────────────────────────────────
void and;
void isNull;
void sql;
void notionSyncLog;
