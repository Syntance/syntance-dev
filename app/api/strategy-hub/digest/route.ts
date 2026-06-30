import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, workspaces } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { buildWeeklyDigest, sendWeeklyDigest } from "@/lib/strategy-hub/digest";

/** Cron / manual trigger tygodniowego digestu (Resend). */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    email?: string;
  };

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
      continue;
    }

    const result = await sendWeeklyDigest(email, payload);
    results.push({ projectId: p.id, ...result });
  }

  return NextResponse.json({ results });
}
