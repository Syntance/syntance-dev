import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/db";
import {
  aiProposals,
  objections,
  competitors,
  segments,
  uvp,
} from "@/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getProjectAlerts } from "@/lib/strategy-hub/alerts";

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
 * Agent AI — 4 tryby (Faza 10, M3). TWARDA zasada „zero direct write": każdy
 * tryb tworzy wpisy `ai_proposals` (status pending); żaden nie modyfikuje
 * encji strategicznych bezpośrednio. Zastosowanie propozycji → accept-proposal.ts.
 */
export async function runAgentMode(
  projectId: string,
  mode: AgentMode
): Promise<{ created: number }> {
  const drafts = await (mode === "audit"
    ? auditMode(projectId)
    : mode === "monitor"
    ? monitorMode(projectId)
    : mode === "improve"
    ? improveMode(projectId)
    : researchMode(projectId));

  if (drafts.length === 0) return { created: 0 };

  await db.insert(aiProposals).values(
    drafts.map((d) => ({
      projectId,
      mode,
      entityType: d.entityType,
      entityId: d.entityId,
      diff: d.diff,
      rationaleMd: d.rationaleMd,
      sources: d.sources ?? null,
      status: "pending" as const,
    }))
  );

  return { created: drafts.length };
}

// ── Audyt: braki w obiekcjach (bez odpowiedzi/dowodu) ─────────────────────────

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
    rationaleMd: `Obiekcja „${o.objectionMd.slice(0, 80)}" nie ma ${
      !o.responseMd ? "odpowiedzi" : "dowodu (proof)"
    }. Zaakceptuj, aby oznaczyć do przeglądu.`,
  }));
}

// ── Monitor: alerty z progów reguł (KPI/domena/wizyty) ────────────────────────

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

// ── Improve: dopisanie odpowiedzi na obiekcję bez responseMd (LLM) ────────────

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
      prompt: `Jesteś strategiem sprzedaży B2C/B2B. Napisz krótką (2-4 zdania), konkretną odpowiedź handlową na obiekcję klienta, po polsku.\n\nObiekcja: "${objection.objectionMd}"\n${uvpRow?.coreUvpMd ? `Kontekst UVP firmy: ${uvpRow.coreUvpMd}` : ""}\n\nOdpowiedz tylko treścią odpowiedzi, bez wstępu.`,
    });

    return [
      {
        entityType: "objections",
        entityId: objection.id,
        diff: { responseMd: { before: null, after: object.response } },
        rationaleMd: `Propozycja odpowiedzi AI na obiekcję bez odpowiedzi.`,
      },
    ];
  } catch (err) {
    console.error("agent improve mode failed", err);
    return [];
  }
}

// ── Research: nowy potencjalny konkurent (LLM, kontekst segmentów) ───────────

async function researchMode(projectId: string): Promise<ProposalDraft[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const [existingCompetitors, segmentRows] = await Promise.all([
    db
      .select({ name: competitors.name })
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
    db
      .select({ name: segments.name, jtbdMd: segments.jtbdMd })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .limit(3),
  ]);

  if (segmentRows.length === 0) return [];

  try {
    interface CompetitorDraft {
      name: string;
      type: "direct" | "indirect" | "none";
      strengthsMd: string;
      weaknessesMd: string;
    }

    const { object } = await generateObject<CompetitorDraft>({
      model: anthropic("claude-haiku-4-5"),
      schema: z.object({
        name: z.string(),
        type: z.enum(["direct", "indirect", "none"]),
        strengthsMd: z.string().max(300),
        weaknessesMd: z.string().max(300),
      }),
      prompt: `Zaproponuj JEDNEGO realnego lub archetypowego konkurenta dla firmy działającej w segmentach: ${segmentRows
        .map((s) => s.name)
        .join(", ")}. Już znani konkurenci (nie powtarzaj): ${
        existingCompetitors.map((c) => c.name).join(", ") || "brak"
      }. Podaj krótkie mocne i słabe strony.`,
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
        rationaleMd: `Propozycja nowego konkurenta na podstawie analizy segmentów.`,
      },
    ];
  } catch (err) {
    console.error("agent research mode failed", err);
    return [];
  }
}

export async function countPendingProposals(projectId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiProposals)
    .where(and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, "pending")));
  return row?.count ?? 0;
}
