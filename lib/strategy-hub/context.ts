import { db } from "@/db";
import { workspaces, projects, adminUsers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/client-portal/queries";
import { redirect } from "next/navigation";

/**
 * Zwraca workspace danego admina.
 *
 * Faza 17 (Role SaaS, multi-seat): jeśli AdminUser ma już przypisany
 * `workspace_id` (zaproszony member albo wcześniej zbackfillowany owner),
 * używamy GO — to pozwala wielu adminom współdzielić jeden workspace.
 * W przeciwnym razie: dotychczasowy fallback po `workspaces.owner_email`
 * (jedno konto = jeden workspace), z leniwym backfillem `AdminUser.workspace_id`,
 * żeby kolejne wywołania nie musiały już schodzić do tej gałęzi.
 */
export async function getOrCreateWorkspaceForAdmin(email: string) {
  const normalized = email.toLowerCase().trim();

  const [adminRow] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalized))
    .limit(1);

  if (adminRow?.workspaceId) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, adminRow.workspaceId))
      .limit(1);
    if (ws) return ws;
    // workspace_id wskazuje na usunięty workspace — spadamy do fallbacku niżej.
  }

  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerEmail, normalized))
    .limit(1);

  const ws =
    existing[0] ??
    (
      await db
        .insert(workspaces)
        .values({
          name: normalized.split("@")[0] ?? "Workspace",
          ownerEmail: normalized,
          ownerId: "00000000-0000-0000-0000-000000000001",
        })
        .returning()
    )[0];

  if (adminRow && !adminRow.workspaceId) {
    await db
      .update(adminUsers)
      .set({ workspaceId: ws.id })
      .where(eq(adminUsers.id, adminRow.id));
  }

  return ws;
}

/**
 * Rola admina w jego workspace ('owner' | 'member'). Domyślnie 'owner' —
 * konta bez wiersza AdminUser (np. przyszłe SSO) traktujemy jako właścicieli.
 */
export async function getAdminRole(email: string): Promise<"owner" | "member"> {
  const normalized = email.toLowerCase().trim();
  const [row] = await db
    .select({ role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalized))
    .limit(1);
  return row?.role === "member" ? "member" : "owner";
}

/**
 * Pobiera projekt po ID bez weryfikacji workspace — używane wyłącznie wewnętrznie
 * lub w kontekście gdzie workspace jest już zweryfikowany (np. layout).
 * @deprecated Preferuj getProjectForAdmin z emailem.
 */
export async function getProjectById(id: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Pobiera projekt tylko jeśli należy do workspace danego admina.
 * Zwraca null jeśli nie znaleziono lub brak uprawnień.
 */
export async function getProjectForAdmin(projectId: string, adminEmail: string) {
  const ws = await getOrCreateWorkspaceForAdmin(adminEmail);
  const rows = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, ws.id),
        isNull(projects.deletedAt)
      )
    )
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
 * Sprawdza dostęp do konkretnego projektu z perspektywy bieżącej sesji.
 * Używane w API routes i layouts.
 */
export async function assertProjectAccess(projectId: string) {
  const access = await getStrategyHubAccess();
  if (!access) return { ok: false as const, status: 401 as const };

  const project = await getProjectForAdmin(projectId, access.session.email);
  if (!project) return { ok: false as const, status: 404 as const };

  const ws = await getOrCreateWorkspaceForAdmin(access.session.email);
  return { ok: true as const, access, workspace: ws, project };
}
