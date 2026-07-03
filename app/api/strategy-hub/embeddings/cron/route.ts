import { NextRequest, NextResponse } from "next/server";
import {
  isCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { reconcileProject } from "@/lib/strategy-hub/embeddings/indexer";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorizedResponse();

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .limit(50);

  let totalIndexed = 0;
  let totalSkipped = 0;
  /** ~12 wywołań Voyage × 21s ≈ 4 min — mieści się w maxDuration 300s. */
  const embedBudget = 12;
  let embedUsed = 0;

  for (const p of projectRows) {
    if (embedUsed >= embedBudget) break;
    const result = await reconcileProject(p.id, {
      embedCap: embedBudget - embedUsed,
    });
    totalIndexed += result.indexed;
    totalSkipped += result.skipped;
    embedUsed += result.attempted;
  }

  return NextResponse.json({
    ok: true,
    projects: projectRows.length,
    indexed: totalIndexed,
    skipped: totalSkipped,
    embedAttempts: embedUsed,
  });
}
