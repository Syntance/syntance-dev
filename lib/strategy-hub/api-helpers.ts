import "server-only";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { projectClients, projects } from "@/db/schema";
import { getClientSession } from "@/lib/auth";
import { getStrategyHubAccess, assertProjectAccess } from "@/lib/strategy-hub/context";

/**
 * Sprawdza dostęp do Strategy Hub w API route.
 * Zwraca albo session (gdy OK), albo gotowy NextResponse 401.
 */
export async function requireApiAccess() {
  const access = await getStrategyHubAccess();
  if (!access) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const, access };
}

/**
 * Sprawdza dostęp do konkretnego projektu — weryfikuje workspace admina.
 * Zastępuje requireApiAccess() we wszystkich route'ach pod /projects/[id]/.
 */
export async function requireProjectAccess(projectId: string) {
  const check = await assertProjectAccess(projectId);
  if (!check.ok) {
    const status = check.status;
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Project not found" },
        { status }
      ),
    };
  }
  return { ...check, ok: true as const };
}

/**
 * Odczyt projektu: admin Strategy Hub albo klient portalu z dostępem przez project_clients.
 * Używaj wyłącznie w handlerach GET — mutacje zostają na requireProjectAccess.
 */
export async function requireProjectReadAccess(projectId: string) {
  const adminCheck = await assertProjectAccess(projectId);
  if (adminCheck.ok) {
    return { ...adminCheck, ok: true as const, role: "editor" as const };
  }

  const session = await getClientSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(projectClients, eq(projectClients.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projectClients.email, session.email),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }

  return {
    ok: true as const,
    role: "client" as const,
    session,
    projectId,
  };
}

/**
 * Autoryzacja endpointów cron/webhook (digest, notion/cron). Fail-closed na
 * produkcji: brak `CRON_SECRET` = 401, tak jak MCP (`lib/strategy-hub/mcp/handle-request.ts`).
 * Lokalnie bez sekretu przepuszcza — wygodne dev.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret === secret) return true;
  // Vercel Cron Jobs wysyłają `Authorization: Bearer ${CRON_SECRET}` automatycznie.
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function cronUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Standardowy 400 z błędem walidacji Zod.
 */
export function badRequest(message = "Invalid input", details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status: 400 }
  );
}

/**
 * Standardowy 404.
 */
export function notFound(resource = "Resource") {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}
