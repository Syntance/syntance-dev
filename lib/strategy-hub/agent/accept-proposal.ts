import "server-only";
import { db } from "@/db";
import { aiProposals, objections, competitors, kpis } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { trackChange } from "@/lib/strategy-hub/track-change";

/** Tabele docelowe, do których agent może zapisać zaakceptowaną propozycję. */
const TARGET_TABLES = {
  objections,
  competitors,
  kpis,
} as const;

type TargetEntity = keyof typeof TARGET_TABLES;

function isTargetEntity(v: string | null): v is TargetEntity {
  return !!v && v in TARGET_TABLES;
}

/**
 * Jedyna droga zapisu propozycji AI do encji strategicznych ("zero direct
 * write"): user klika Akceptuj w kolejce `ai_proposals`, tu i tylko tu
 * zmiana trafia do tabeli docelowej, ze `source: "ai"` + wpisem w change_history.
 */
export async function acceptProposal(
  projectId: string,
  proposalId: string,
  userId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const [proposal] = await db
    .select()
    .from(aiProposals)
    .where(and(eq(aiProposals.id, proposalId), eq(aiProposals.projectId, projectId)));

  if (!proposal) return { ok: false, error: "not_found" };
  if (proposal.status !== "pending") return { ok: false, error: "already_resolved" };

  const diff = proposal.diff as Record<string, { before: unknown; after: unknown }> | null;

  if (diff && isTargetEntity(proposal.entityType)) {
    const table = TARGET_TABLES[proposal.entityType];
    const patch: Record<string, unknown> = {};
    for (const [field, { after }] of Object.entries(diff)) {
      patch[field] = after;
    }
    if ("source" in table) patch.source = "ai";

    if (proposal.entityId) {
      await db
        .update(table)
        .set(patch as never)
        .where(and(eq(table.id, proposal.entityId), eq(table.projectId, projectId)));
      await trackChange({
        projectId,
        entityType: proposal.entityType === "objections" ? "objection" : proposal.entityType.slice(0, -1),
        entityId: proposal.entityId,
        patch,
        source: "ai",
        userId,
      });
    } else {
      const [inserted] = await db
        .insert(table)
        .values({ ...patch, projectId } as never)
        .returning({ id: table.id });
      if (inserted) {
        await trackChange({
          projectId,
          entityType: proposal.entityType === "objections" ? "objection" : proposal.entityType.slice(0, -1),
          entityId: inserted.id,
          patch,
          source: "ai",
          userId,
        });
      }
    }
  } else if (isTargetEntity(proposal.entityType) && proposal.entityId) {
    // Audyt/monitor bez diffu: akceptacja = oznacz do przeglądu (review_flag).
    const table = TARGET_TABLES[proposal.entityType];
    if ("reviewFlag" in table) {
      await db
        .update(table)
        .set({ reviewFlag: true } as never)
        .where(and(eq(table.id, proposal.entityId), eq(table.projectId, projectId)));
    }
  }

  await db
    .update(aiProposals)
    .set({ status: "accepted", resolvedAt: new Date(), resolvedBy: userId ?? null })
    .where(eq(aiProposals.id, proposalId));

  return { ok: true };
}

export async function rejectProposal(
  projectId: string,
  proposalId: string,
  userId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  await db
    .update(aiProposals)
    .set({ status: "rejected", resolvedAt: new Date(), resolvedBy: userId ?? null })
    .where(and(eq(aiProposals.id, proposalId), eq(aiProposals.projectId, projectId)));
  return { ok: true };
}
