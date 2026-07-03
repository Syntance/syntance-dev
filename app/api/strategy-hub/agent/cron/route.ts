import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  isCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { runAgentMode } from "@/lib/strategy-hub/agent/run-agent";
import {
  applyFunnelRelations,
  suggestFunnelRelations,
} from "@/lib/strategy-hub/auto-relations";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorizedResponse();

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .limit(10);

  let autoRelations = 0;
  let agentRuns = 0;

  for (const p of projectRows) {
    try {
      const suggestions = await suggestFunnelRelations(p.id);
      if (suggestions.length > 0) {
        const applied = await applyFunnelRelations(
          p.id,
          suggestions.flatMap((s) =>
            s.targets.map((t) => ({
              elementId: s.elementId,
              kind: t.kind,
              targetId: t.targetId,
            }))
          )
        );
        autoRelations += applied.inserted;
      }
    } catch {
      /* ignore */
    }

    for (const mode of ["monitor", "audit"] as const) {
      try {
        await runAgentMode(p.id, mode);
        agentRuns += 1;
      } catch {
        /* ignore */
      }
    }
  }

  return NextResponse.json({
    ok: true,
    projects: projectRows.length,
    autoRelations,
    agentRuns,
  });
}
