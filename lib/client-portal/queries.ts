import "server-only";
import { db } from "@/db";
import { projects, projectClients, adminUsers, clientUsers } from "@/db/schema";
import { eq, isNull, and, inArray } from "drizzle-orm";

/**
 * Zastępuje `sanity/queries.ts` jako źródło prawdy dla dashboardu klienta
 * `/projects/[slug]` (Faza 16, M2). Sanity trzymała `project`+`client` jako
 * osobne dokumenty z relacją `client.projects[]`; tutaj tę relację reprezentuje
 * tabela `project_clients`, a "isAdmin" = obecność e-maila w `AdminUser`
 * (dokładny parytet: konto z dostępem do Strategy Hub widzi WSZYSTKIE projekty).
 */

type ProjectRow = typeof projects.$inferSelect;

export interface ClientPortalProject {
  _id: string;
  name: string;
  slug: string;
  clientDomain: string | null;
  previewUrl: string;
  status: string;
  description: string | null;
  _createdAt: string;
  _updatedAt: string;
}

export interface ClientPortalClientMeta {
  name: string | null;
  email: string;
}

function toPortalProject(row: ProjectRow): ClientPortalProject {
  return {
    _id: row.id,
    name: row.name,
    slug: row.slug,
    clientDomain: row.domain,
    previewUrl: row.previewUrl ?? (row.domain ? `https://${row.domain}` : ""),
    status: row.deliveryStatus,
    description: row.description,
    _createdAt: row.createdAt.toISOString(),
    _updatedAt: row.updatedAt.toISOString(),
  };
}

async function isAdminEmail(email: string): Promise<boolean> {
  const rows = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  return rows.length > 0;
}

async function getAllActiveProjects(): Promise<ClientPortalProject[]> {
  const rows = await db.select().from(projects).where(isNull(projects.deletedAt));
  return rows.map(toPortalProject);
}

export async function getProjectsForUser(email: string): Promise<{
  projects: ClientPortalProject[];
  isAdmin: boolean;
  client: ClientPortalClientMeta | null;
}> {
  const [isAdmin, [clientRow]] = await Promise.all([
    isAdminEmail(email),
    db.select().from(clientUsers).where(eq(clientUsers.email, email)).limit(1),
  ]);

  const client: ClientPortalClientMeta | null =
    clientRow || isAdmin ? { name: clientRow?.name ?? null, email } : null;

  if (isAdmin) {
    return { projects: await getAllActiveProjects(), isAdmin: true, client };
  }

  const access = await db
    .select({ projectId: projectClients.projectId })
    .from(projectClients)
    .where(eq(projectClients.email, email));

  if (access.length === 0) {
    return { projects: [], isAdmin: false, client };
  }

  const rows = await db
    .select()
    .from(projects)
    .where(
      and(
        inArray(
          projects.id,
          access.map((a) => a.projectId)
        ),
        isNull(projects.deletedAt)
      )
    );
  return { projects: rows.map(toPortalProject), isAdmin: false, client };
}

export async function getProjectBySlugForUser(
  slug: string,
  email: string
): Promise<ClientPortalProject | null> {
  const { projects: accessible, isAdmin } = await getProjectsForUser(email);
  if (isAdmin) {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
      .limit(1);
    return row ? toPortalProject(row) : null;
  }
  return accessible.find((p) => p.slug === slug) ?? null;
}

export async function getProjectClients(
  slug: string
): Promise<{ email: string; name?: string }[]> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!project) return [];
  return db
    .select({ email: projectClients.email })
    .from(projectClients)
    .where(eq(projectClients.projectId, project.id));
}

/** Czy e-mail ma jakąkolwiek relację klienta (dostęp do projektu lub istniejące konto). */
export async function getClientAccessSummary(email: string): Promise<{
  isKnownClient: boolean;
  isAdmin: boolean;
  hasPassword: boolean;
  name: string | null;
}> {
  const [isAdmin, [clientRow], access] = await Promise.all([
    isAdminEmail(email),
    db.select().from(clientUsers).where(eq(clientUsers.email, email)).limit(1),
    db
      .select({ id: projectClients.id })
      .from(projectClients)
      .where(eq(projectClients.email, email))
      .limit(1),
  ]);
  return {
    isKnownClient: isAdmin || access.length > 0 || !!clientRow,
    isAdmin,
    hasPassword: !!clientRow?.passwordHash,
    name: clientRow?.name ?? null,
  };
}
