import { db } from "@/db";
import { workspaces, projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { getProjectsForUser } from "@/sanity/queries";
import { redirect } from "next/navigation";

const SYSTEM_OWNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Zwraca pojedynczy workspace dla MVP (single-tenant na start).
 * Tworzy workspace, jeśli nie istnieje.
 */
export async function getOrCreateWorkspace() {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0];

  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Syntance", ownerId: SYSTEM_OWNER_ID })
    .returning();
  return ws;
}

export async function getProjectById(id: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProjectBySlug(slug: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Dostęp do Strategy Hub: konto admin (Prisma) lub klient Sanity z flagą isAdmin.
 */
export async function requireStrategyHubAccess() {
  const adminSession = await getAdminSession();
  if (adminSession) return { type: "admin" as const, session: adminSession };

  const clientSession = await getClientSession();
  if (clientSession) {
    const { isAdmin } = await getProjectsForUser(clientSession.email);
    if (isAdmin) return { type: "sanity-admin" as const, session: clientSession };
  }

  redirect("/login");
}

/**
 * Wersja dla API routes — zwraca null zamiast redirect.
 */
export async function getStrategyHubAccess() {
  const adminSession = await getAdminSession();
  if (adminSession) return { type: "admin" as const, session: adminSession };

  const clientSession = await getClientSession();
  if (clientSession) {
    const { isAdmin } = await getProjectsForUser(clientSession.email);
    if (isAdmin) return { type: "sanity-admin" as const, session: clientSession };
  }

  return null;
}

/**
 * Wymaga sesji admina dla operacji w Strategy Hubie.
 * Rzuca, gdy brak sesji — używaj w Server Actions / API.
 */
export async function requireAdmin() {
  const access = await requireStrategyHubAccess();
  return access.session;
}
