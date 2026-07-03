import "server-only";
import { randomUUID } from "crypto";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/db";
import {
  aiProposals,
  competitors,
  objections,
  segments,
  uvp,
} from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { getProjectAlerts } from "@/lib/strategy-hub/alerts";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import { trackChange, entityTypeFor } from "@/lib/strategy-hub/track-change";

export const AGENT_MODES = ["audit", "research", "improve", "monitor"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

interface ProposalDraft {
  entityType: string | null;
  entityId: string | null;
  diff: Record<string, { before: unknown; after: unknown }> | null;
  rationaleMd: string;
  sources?: { title: string; url: string }[];
}

/**
 * Agent AI — zmiany stosowane od razu (status applied) z batchId do undo.
 */
export async function runAgentMode(
  projectId: string,
  mode: AgentMode,
  opts?: { batchId?: string }
): Promise<{ created: number; batchId: string }> {
  const batchId = opts?.batchId ?? randomUUID();
  const drafts = await (mode === "audit"
    ? auditMode(projectId)
    : mode === "monitor"
      ? monitorMode(projectId)
      : mode === "improve"
        ? improveMode(projectId)
        : researchMode(projectId));

  if (drafts.length === 0) return { created: 0, batchId };

  let applied = 0;

  for (const draft of drafts) {
    const ok = await applyDraft(projectId, draft, batchId);
    if (ok) applied += 1;

    await db.insert(aiProposals).values({
      projectId,
      mode,
      entityType: draft.entityType,
      entityId: draft.entityId,
      diff: draft.diff,
      rationaleMd: draft.rationaleMd,
      sources: draft.sources ?? null,
      status: "applied",
      batchId,
    });
  }

  return { created: applied, batchId };
}

async function applyDraft(
  projectId: string,
  draft: ProposalDraft,
  batchId: string
): Promise<boolean> {
  if (!draft.entityType) return true;

  const def = getListEntity(draft.entityType);
  if (!def) return false;

  if (draft.diff && draft.entityId) {
    const patch: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    for (const [field, { before: b, after }] of Object.entries(draft.diff)) {
      patch[field] = after;
      before[field] = b;
    }
    const parsed = def.patchSchema.safeParse(patch);
    if (!parsed.success) return false;
    const updated = await def.update(projectId, draft.entityId, parsed.data);
    if (!updated) return false;
    await trackChange({
      projectId,
      entityType: entityTypeFor(draft.entityType),
      entityId: draft.entityId,
      patch,
      before,
      source: "ai",
      batchId,
    });
    return true;
  }

  if (draft.diff && !draft.entityId) {
    const patch: Record<string, unknown> = {};
    for (const [field, { after }] of Object.entries(draft.diff)) {
      patch[field] = after;
    }
    const parsed = def.createSchema.safeParse(patch);
    if (!parsed.success) return false;
    const row = await def.create(projectId, parsed.data);
    const itemId = typeof row?.id === "string" ? row.id : null;
    if (!itemId) return false;
    await trackChange({
      projectId,
      entityType: entityTypeFor(draft.entityType),
      entityId: itemId,
      patch: { __created: true, ...patch },
      source: "ai",
      batchId,
    });
    return true;
  }

  if (draft.entityId && !draft.diff) {
    await trackChange({
      projectId,
      entityType: entityTypeFor(draft.entityType),
      entityId: draft.entityId,
      patch: { reviewFlag: true },
      source: "ai",
      batchId,
    });
    return true;
  }

  return true;
}

async function auditMode(projectId: string): Promise<ProposalDraft[]> {
  const rows = await db
    .select()
    .from(objections)
    .where(
      and(
        eq(objections.projectId, projectId),
        isNull(objections.deletedAt),
        eq(objections.status, "active"),
        or(isNull(objections.responseMd), isNull(objections.proofMd))
      )
    )
    .limit(5);

  return rows.map((o) => ({
    entityType: "objections",
    entityId: o.id,
    diff: null,
    rationaleMd: `Obiekcja „${o.objectionMd.slice(0, 80)}" wymaga uzupełnienia — oznaczono do przeglądu.`,
  }));
}

async function monitorMode(projectId: string): Promise<ProposalDraft[]> {
  const alerts = await getProjectAlerts(projectId);
  return alerts.slice(0, 8).map((a) => {
    const entityId = a.kind === "kpi" ? a.id.replace(/^kpi-/, "") : null;
    return {
      entityType: entityId ? "kpis" : null,
      entityId,
      diff: null,
      rationaleMd: `**${a.title}** — ${a.message}`,
    };
  });
}

async function improveMode(projectId: string): Promise<ProposalDraft[]> {
  const [objection] = await db
    .select()
    .from(objections)
    .where(
      and(
        eq(objections.projectId, projectId),
        isNull(objections.deletedAt),
        eq(objections.status, "active"),
        isNull(objections.responseMd)
      )
    )
    .limit(1);

  if (!objection || !process.env.ANTHROPIC_API_KEY) return [];

  const [uvpRow] = await db.select().from(uvp).where(eq(uvp.projectId, projectId));

  try {
    const { object } = await generateObject<{ response: string }>({
      model: anthropic("claude-haiku-4-5"),
      schema: z.object({ response: z.string().max(600) }),
      prompt: `Napisz krótką odpowiedź handlową (2-4 zdania, PL) na obiekcję: "${objection.objectionMd}". ${uvpRow?.coreUvpMd ? `UVP: ${uvpRow.coreUvpMd}` : ""}`,
    });

    return [
      {
        entityType: "objections",
        entityId: objection.id,
        diff: { responseMd: { before: null, after: object.response } },
        rationaleMd: "AI dopisało odpowiedź na obiekcję.",
      },
    ];
  } catch (err) {
    console.error("agent improve mode failed", err);
    return [];
  }
}

async function researchMode(projectId: string): Promise<ProposalDraft[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const [existingCompetitors, segmentRows] = await Promise.all([
    db
      .select({ name: competitors.name })
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
    db
      .select({ name: segments.name })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .limit(3),
  ]);

  if (segmentRows.length === 0) return [];

  try {
    const { object } = await generateObject<{
      name: string;
      type: "direct" | "indirect" | "none";
      strengthsMd: string;
      weaknessesMd: string;
    }>({
      model: anthropic("claude-haiku-4-5"),
      schema: z.object({
        name: z.string(),
        type: z.enum(["direct", "indirect", "none"]),
        strengthsMd: z.string().max(300),
        weaknessesMd: z.string().max(300),
      }),
      prompt: `Zaproponuj konkurenta dla segmentów: ${segmentRows.map((s) => s.name).join(", ")}. Nie powtarzaj: ${existingCompetitors.map((c) => c.name).join(", ") || "brak"}.`,
    });

    return [
      {
        entityType: "competitors",
        entityId: null,
        diff: {
          name: { before: null, after: object.name },
          type: { before: null, after: object.type },
          strengthsMd: { before: null, after: object.strengthsMd },
          weaknessesMd: { before: null, after: object.weaknessesMd },
        },
        rationaleMd: "AI dodało propozycję konkurenta z researchu segmentów.",
      },
    ];
  } catch (err) {
    console.error("agent research mode failed", err);
    return [];
  }
}
