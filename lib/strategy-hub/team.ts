import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminUsers, organizationMembers, passwordResetTokens } from "@/db/schema";
import { and, asc, count, eq } from "drizzle-orm";
import { generateResetToken } from "@/lib/auth";
import { sendTeamInviteEmail } from "@/lib/email";
import {
  getCurrentOrganizationForAdmin,
  getOrganizationRole,
  type OrganizationRole,
} from "@/lib/strategy-hub/context";

export interface TeamMember {
  /** `AdminUser.id` — stabilny identyfikator konta, także w innych organizacjach. */
  id: string;
  email: string;
  role: OrganizationRole;
}

/** Zespół bieżącej organizacji wraz z kontekstem, w którym go pokazujemy. */
export interface TeamOverview {
  organizationId: string;
  organizationName: string;
  /** Rola pytającego W TEJ organizacji — decyduje o widoczności akcji zarządczych. */
  currentRole: OrganizationRole;
  members: TeamMember[];
}

export class TeamAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamAccessError";
  }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function toRole(value: string): OrganizationRole {
  return value === "owner" ? "owner" : "member";
}

/**
 * Rzuca TeamAccessError, jeśli `requesterEmail` nie jest ownerem TEJ organizacji.
 * Brak członkostwa też kończy się błędem — `getOrganizationRole` zwraca wtedy
 * null, a rola 'owner' w innej organizacji nic tutaj nie znaczy.
 */
async function assertOwner(
  requesterEmail: string,
  organizationId: string
): Promise<void> {
  const role = await getOrganizationRole(requesterEmail, organizationId);
  if (role !== "owner") {
    throw new TeamAccessError(
      "Tylko właściciel organizacji może zarządzać zespołem."
    );
  }
}

/** Członkowie organizacji: `organizationMembers` JOIN `AdminUser` po adminUserId. */
async function listMembersOfOrganization(
  organizationId: string
): Promise<TeamMember[]> {
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(adminUsers, eq(adminUsers.id, organizationMembers.adminUserId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(adminUsers.email));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: toRole(r.role),
  }));
}

/** Liczba ownerów organizacji — strażnik przed osieroceniem organizacji. */
async function countOwners(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner")
      )
    );
  return row?.value ?? 0;
}

/** Członkowie bieżącej organizacji admina. */
export async function listOrganizationMembers(
  requesterEmail: string
): Promise<TeamMember[]> {
  const organization = await getCurrentOrganizationForAdmin(requesterEmail);
  return listMembersOfOrganization(organization.id);
}

/**
 * Komplet danych ekranu „Zespół": która organizacja, jaka rola pytającego,
 * jacy członkowie. Jedno wejście, żeby UI i API nie rozjechały się co do
 * organizacji, której dotyczy lista.
 */
export async function getTeamOverview(
  requesterEmail: string
): Promise<TeamOverview> {
  const organization = await getCurrentOrganizationForAdmin(requesterEmail);
  const [members, role] = await Promise.all([
    listMembersOfOrganization(organization.id),
    getOrganizationRole(requesterEmail, organization.id),
  ]);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    // Brak wiersza członkostwa (wyścig z usunięciem) → najniższe uprawnienia.
    currentRole: role ?? "member",
    members,
  };
}

/**
 * Zaprasza admina do bieżącej organizacji.
 *
 * Konto AdminUser powstaje tylko wtedy, gdy adresu jeszcze nie ma w systemie —
 * z placeholderowym hashem (nigdy nieweryfikowalnym) i tokenem
 * purpose='admin_invite', który set-password nadpisze prawdziwym hashem.
 * Konto, które już istnieje (bo należy do innej organizacji), dostaje wyłącznie
 * nowe członkostwo — bez tokenu i bez linku do ustawiania hasła, bo taki link
 * na cudze, działające konto byłby ścieżką przejęcia go przez dowolnego ownera.
 */
export async function inviteMember(
  requesterEmail: string,
  inviteeEmail: string
): Promise<TeamMember> {
  const organization = await getCurrentOrganizationForAdmin(requesterEmail);
  await assertOwner(requesterEmail, organization.id);

  const normalized = normalizeEmail(inviteeEmail);
  if (!normalized || !normalized.includes("@")) {
    throw new TeamAccessError("Nieprawidłowy adres e-mail.");
  }

  const [existing] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalized))
    .limit(1);

  if (existing) {
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organization.id),
          eq(organizationMembers.adminUserId, existing.id)
        )
      )
      .limit(1);

    if (membership) {
      throw new TeamAccessError("Ta osoba jest już w zespole.");
    }

    await db
      .insert(organizationMembers)
      .values({
        organizationId: organization.id,
        adminUserId: existing.id,
        role: "member",
      })
      .onConflictDoNothing();

    return { id: existing.id, email: existing.email, role: "member" };
  }

  const [member] = await db
    .insert(adminUsers)
    .values({
      id: randomUUID(),
      email: normalized,
      // Placeholder — nigdy nie da się nim zalogować, dopóki właściciel konta
      // nie ustawi hasła przez link z emaila.
      passwordHash: `invite:${randomUUID()}`,
      role: "member",
    })
    .returning();

  await db
    .insert(organizationMembers)
    .values({
      organizationId: organization.id,
      adminUserId: member.id,
      role: "member",
    })
    .onConflictDoNothing();

  const token = generateResetToken();
  await db.insert(passwordResetTokens).values({
    id: randomUUID(),
    email: normalized,
    token,
    purpose: "admin_invite",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await sendTeamInviteEmail(normalized, token, organization.name);

  return { id: member.id, email: member.email, role: "member" };
}

/**
 * Usuwa członka z bieżącej organizacji: kasujemy WYŁĄCZNIE wiersz
 * `organizationMembers`. Konto AdminUser zostaje, bo może należeć do innych
 * organizacji — usunięcie go odebrałoby dostęp również tam.
 */
export async function removeMember(
  requesterEmail: string,
  memberId: string
): Promise<void> {
  const organization = await getCurrentOrganizationForAdmin(requesterEmail);
  await assertOwner(requesterEmail, organization.id);

  const [target] = await db
    .select({
      email: adminUsers.email,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(adminUsers, eq(adminUsers.id, organizationMembers.adminUserId))
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.adminUserId, memberId)
      )
    )
    .limit(1);

  if (!target) {
    throw new TeamAccessError("Nie znaleziono członka zespołu w tej organizacji.");
  }
  if (normalizeEmail(target.email) === normalizeEmail(requesterEmail)) {
    throw new TeamAccessError("Nie możesz usunąć samego siebie z zespołu.");
  }
  if (toRole(target.role) === "owner" && (await countOwners(organization.id)) <= 1) {
    throw new TeamAccessError(
      "Nie możesz usunąć ostatniego właściciela organizacji."
    );
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.adminUserId, memberId)
      )
    );
}
