import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  organizations,
  organizationMembers,
  adminUsers,
  healthScoreSnapshots,
  digestLog,
} from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
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

/**
 * Adres, na który idzie digest organizacji: e-mail admina z rolą `owner`
 * w `organizationMembers` (najstarsze członkostwo, żeby wynik był
 * deterministyczny przy kilku właścicielach).
 *
 * Świadomie NIE sięgamy po `organizations.ownerEmail` — to wyłącznie ślad po
 * twórcy (@deprecated). Migracja 0031 założyła każdemu takiemu właścicielowi
 * wiersz członkostwa, więc odbiorca jest ten sam, a źródło prawdy jedno.
 */
async function findOrganizationOwnerEmail(
  organizationId: string
): Promise<string | null> {
  const [row] = await db
    .select({ email: adminUsers.email })
    .from(organizationMembers)
    .innerJoin(adminUsers, eq(adminUsers.id, organizationMembers.adminUserId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner")
      )
    )
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);

  return row?.email ?? null;
}

async function runDigest(body: { projectId?: string; email?: string }) {
  // Join z `organizations` odsiewa projekty archiwalnych organizacji:
  // migracja 0033 ustawiła `deleted_at` organizacjom-śmieciom po testach,
  // a do takich nie wysyłamy ani digestu, ani nie budujemy im snapshotów.
  const projectRows = body.projectId
    ? await db
        .select({ id: projects.id, organizationId: projects.organizationId })
        .from(projects)
        .innerJoin(
          organizations,
          eq(organizations.id, projects.organizationId)
        )
        .where(
          and(
            eq(projects.id, body.projectId),
            isNull(projects.deletedAt),
            isNull(organizations.deletedAt)
          )
        )
        .limit(1)
    : await db
        .select({ id: projects.id, organizationId: projects.organizationId })
        .from(projects)
        .innerJoin(
          organizations,
          eq(organizations.id, projects.organizationId)
        )
        .where(and(isNull(projects.deletedAt), isNull(organizations.deletedAt)))
        .limit(20);

  const results: { projectId: string; sent: boolean; reason?: string }[] = [];
  // Cache odbiorców per organizacja — jeden cron obsługuje wiele projektów
  // tej samej organizacji, nie ma po co pytać bazy raz na projekt.
  const odbiorcyOrganizacji = new Map<string, string | null>();

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
      if (!odbiorcyOrganizacji.has(p.organizationId)) {
        odbiorcyOrganizacji.set(
          p.organizationId,
          await findOrganizationOwnerEmail(p.organizationId)
        );
      }
      email = odbiorcyOrganizacji.get(p.organizationId) ?? undefined;
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
