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
  const { ok: _ok, ...rest } = check;
  return { ok: true as const, ...rest };
}

export type ProjectReadRole = "editor" | "client";

/**
 * Odczyt projektu: admin Strategy Hub albo klient portalu z dostępem przez project_clients.
 * Używaj wyłącznie w handlerach GET — mutacje zostają na requireProjectAccess.
 */
export async function requireProjectReadAccess(projectId: string) {
  const adminCheck = await assertProjectAccess(projectId);
  if (adminCheck.ok) {
    const { ok: _ok, ...rest } = adminCheck;
    return { ok: true as const, role: "editor" as const, ...rest };
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
