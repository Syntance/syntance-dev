import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, workspaces, healthScoreSnapshots, digestLog } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { buildWeeklyDigest, sendWeeklyDigest } from "@/lib/strategy-hub/digest";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { isCronAuthorized, cronUnauthorizedResponse } from "@/lib/strategy-hub/api-helpers";

/** Vercel Cron (vercel.json, weekly) — wywołanie GET bez ciała, wszystkie projekty. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorizedResponse();
  return runDigest({});
}

/** Cron / manual trigger tygodniowego digestu (Resend). */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    email?: string;
  };

  return runDigest(body);
}

async function runDigest(body: { projectId?: string; email?: string }) {
  const projectRows = body.projectId
    ? await db
        .select({ id: projects.id, workspaceId: projects.workspaceId })
        .from(projects)
        .where(
          and(eq(projects.id, body.projectId), isNull(projects.deletedAt))
        )
        .limit(1)
    : await db
        .select({ id: projects.id, workspaceId: projects.workspaceId })
        .from(projects)
        .where(isNull(projects.deletedAt))
        .limit(20);

  const results: { projectId: string; sent: boolean; reason?: string }[] = [];

  for (const p of projectRows) {
    // Snapshot health score — niezależnie od tego, czy digest email się wyśle,
    // żeby trend na /projects/[slug]/reports rósł co tydzień (Faza 16, M2).
    try {
      const health = await computeProjectHealth(p.id);
      await db.insert(healthScoreSnapshots).values({
        projectId: p.id,
        score: health.score,
        breakdown: health.modules.map((m) => ({
          key: m.key,
          label: m.label,
          score: m.score,
        })),
      });
    } catch {
      // best-effort — snapshot nie może zablokować wysyłki digestu
    }

    const payload = await buildWeeklyDigest(p.id);
    if (!payload) continue;

    let email = body.email;
    if (!email) {
      const [ws] = await db
        .select({ ownerEmail: workspaces.ownerEmail })
        .from(workspaces)
        .where(eq(workspaces.id, p.workspaceId))
        .limit(1);
      email = ws?.ownerEmail ?? undefined;
    }

    if (!email) {
      results.push({ projectId: p.id, sent: false, reason: "no email" });
      await db.insert(digestLog).values({
        projectId: p.id,
        sent: false,
        reason: "no email",
        alertCount: payload.alertCount,
        kpiSummary: payload.kpiSummary,
      });
      continue;
    }

    const result = await sendWeeklyDigest(email, payload);
    results.push({ projectId: p.id, ...result });
    await db.insert(digestLog).values({
      projectId: p.id,
      sentTo: email,
      sent: result.sent,
      reason: result.reason,
      alertCount: payload.alertCount,
      kpiSummary: payload.kpiSummary,
    });
  }

  return NextResponse.json({ results });
}
