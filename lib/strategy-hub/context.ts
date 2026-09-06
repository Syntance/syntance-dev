import { db } from "@/db";
import {
  organizations,
  organizationMembers,
  projects,
  adminUsers,
} from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/client-portal/queries";
import { redirect } from "next/navigation";

/**
 * Kontekst organizacji — granica tenanta Strategy Hub.
 *
 * Model dostępu: admin agencji należy do N organizacji przez
 * `organizationMembers`. Brak wiersza = brak dostępu, bez wyjątków; nie ma
 * roli „superadmina" widzącej cudze organizacje (izolacja, którą wcześniej
 * dawał `workspaces.owner_email`, a którą audyt 2026-07 przyłapał na wycieku
 * w /sync). Rola `owner`/`member` jest rolą W ORGANIZACJI.
 */

/** Ciasteczko z wybraną organizacją (selektor w sidebarze). */
export const ORG_COOKIE = "sh_org";

export type OrganizationRow = typeof organizations.$inferSelect;
export type OrganizationRole = "owner" | "member";

export interface OrganizationWithRole {
  organization: OrganizationRow;
  role: OrganizationRole;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base.slice(0, 90) || "organizacja";
}

async function getAdminRow(email: string) {
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizeEmail(email)))
    .limit(1);
  return row ?? null;
}

/** Organizacje, do których admin ma dostęp — posortowane po nazwie. */
export async function listOrganizationsForAdmin(
  email: string
): Promise<OrganizationWithRole[]> {
  const admin = await getAdminRow(email);
  if (!admin) return [];

  const rows = await db
    .select({ organization: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId)
    )
    .where(
      and(
        eq(organizationMembers.adminUserId, admin.id),
        isNull(organizations.deletedAt)
      )
    )
    .orderBy(asc(organizations.name));

  return rows.map((r) => ({
    organization: r.organization,
    role: r.role === "owner" ? "owner" : "member",
  }));
}

/**
 * Tworzy organizację i czyni admina jej właścicielem.
 * Slug jest unikalny globalnie — przy kolizji dokładamy sufiks liczbowy.
 */
export async function createOrganizationForAdmin(
  email: string,
  name: string
): Promise<OrganizationRow> {
  const admin = await getAdminRow(email);
  if (!admin) {
    throw new Error(`Brak konta AdminUser dla ${email} — nie mogę utworzyć organizacji.`);
  }

  const base = toSlug(name);
  let slug = base;
  for (let i = 2; i < 100; i += 1) {
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      ownerEmail: normalizeEmail(email),
      ownerId: "00000000-0000-0000-0000-000000000001",
    })
    .returning();

  await db
    .insert(organizationMembers)
    .values({ organizationId: org.id, adminUserId: admin.id, role: "owner" })
    .onConflictDoNothing();

  return org;
}

/**
 * Bieżąca organizacja admina: jawny parametr → ciasteczko `sh_org` → pierwsza
 * dostępna. Gdy admin nie ma jeszcze żadnej (świeże konto), zakłada domyślną —
 * odpowiednik dawnego `getOrCreateWorkspaceForAdmin`, żeby onboarding działał
 * bez dodatkowego kroku.
 *
 * Ciasteczko wskazujące organizację BEZ członkostwa jest ignorowane, nie
 * podnosi błędu — użytkownik dostaje pierwszą swoją zamiast 403 po utracie
 * dostępu.
 */
export async function getCurrentOrganizationForAdmin(
  email: string,
  explicitOrganizationId?: string
): Promise<OrganizationRow> {
  const dostepne = await listOrganizationsForAdmin(email);

  if (explicitOrganizationId) {
    const trafiona = dostepne.find(
      (o) => o.organization.id === explicitOrganizationId
    );
    if (trafiona) return trafiona.organization;
  }

  const cookieStore = await cookies();
  const zCiasteczka = cookieStore.get(ORG_COOKIE)?.value;
  if (zCiasteczka) {
    const trafiona = dostepne.find((o) => o.organization.id === zCiasteczka);
    if (trafiona) return trafiona.organization;
  }

  if (dostepne.length > 0) return dostepne[0].organization;

  return createOrganizationForAdmin(email, normalizeEmail(email).split("@")[0] ?? "Organizacja");
}

/**
 * Bieżąca organizacja BEZ tworzenia czegokolwiek — dla odczytów, które nie
 * mogą mieć efektów ubocznych (np. `/api/auth/me` odpytywane przez sidebar).
 * Zwraca `null`, gdy admin nie należy jeszcze do żadnej organizacji.
 */
export async function getCurrentOrganizationOrNull(
  email: string
): Promise<OrganizationWithRole | null> {
  const dostepne = await listOrganizationsForAdmin(email);
  if (dostepne.length === 0) return null;

  const cookieStore = await cookies();
  const zCiasteczka = cookieStore.get(ORG_COOKIE)?.value;
  if (zCiasteczka) {
    const trafiona = dostepne.find((o) => o.organization.id === zCiasteczka);
    if (trafiona) return trafiona;
  }
  return dostepne[0];
}

/** Rola admina w danej organizacji; `null` = brak dostępu. */
export async function getOrganizationRole(
  email: string,
  organizationId: string
): Promise<OrganizationRole | null> {
  const admin = await getAdminRow(email);
  if (!admin) return null;

  const [row] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.adminUserId, admin.id),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) return null;
  return row.role === "owner" ? "owner" : "member";
}

/** Twardy strażnik: rzuca, gdy admin nie należy do organizacji. */
export async function assertOrganizationAccess(
  email: string,
  organizationId: string
): Promise<OrganizationRole> {
  const role = await getOrganizationRole(email, organizationId);
  if (!role) {
    throw new Error("Brak dostępu do organizacji.");
  }
  return role;
}

/**
 * Pobiera projekt po ID bez weryfikacji organizacji — wyłącznie tam, gdzie
 * dostęp jest już potwierdzony wyżej (np. layout po `assertProjectAccess`).
 * @deprecated Preferuj `getProjectForAdmin` z e-mailem.
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
 * Projekt widoczny dla admina: musi leżeć w organizacji, której admin jest
 * członkiem. Zwraca `null` przy braku projektu LUB braku uprawnień — celowo
 * nie rozróżniamy tych przypadków na zewnątrz.
 */
export async function getProjectForAdmin(projectId: string, adminEmail: string) {
  const admin = await getAdminRow(adminEmail);
  if (!admin) return null;

  const rows = await db
    .select({ project: projects })
    .from(projects)
    .innerJoin(
      organizationMembers,
      eq(organizationMembers.organizationId, projects.organizationId)
    )
    .where(
      and(
        eq(projects.id, projectId),
        eq(organizationMembers.adminUserId, admin.id),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  return rows[0]?.project ?? null;
}

/**
 * Dostęp do Strategy Hub: konto admina albo klient portalu z flagą isAdmin.
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
 * Używane w API routes i layoutach.
 */
export async function assertProjectAccess(projectId: string) {
  const access = await getStrategyHubAccess();
  if (!access) return { ok: false as const, status: 401 as const };

  const project = await getProjectForAdmin(projectId, access.session.email);
  if (!project) return { ok: false as const, status: 404 as const };

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, project.organizationId))
    .limit(1);

  return { ok: true as const, access, organization, project };
}
