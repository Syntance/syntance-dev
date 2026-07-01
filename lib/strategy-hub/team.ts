import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminUsers, passwordResetTokens, workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateResetToken } from "@/lib/auth";
import { sendTeamInviteEmail } from "@/lib/email";
import { getAdminRole, getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";

export interface TeamMember {
  id: string;
  email: string;
  role: "owner" | "member";
}

export class TeamAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamAccessError";
  }
}

/** Rzuca TeamAccessError, jeśli `requesterEmail` nie jest ownerem workspace. */
async function assertOwner(requesterEmail: string): Promise<void> {
  const role = await getAdminRole(requesterEmail);
  if (role !== "owner") {
    throw new TeamAccessError(
      "Tylko właściciel workspace może zarządzać zespołem."
    );
  }
}

export async function listWorkspaceMembers(
  requesterEmail: string
): Promise<TeamMember[]> {
  const ws = await getOrCreateWorkspaceForAdmin(requesterEmail);
  const rows = await db
    .select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.workspaceId, ws.id));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role === "member" ? "member" : "owner",
  }));
}

/**
 * Zaprasza nowego admina do workspace właściciela. Tworzy konto AdminUser
 * bez hasła (placeholder hash, nigdy nie weryfikowalny — patrz set-password
 * flow z purpose='admin_invite', który je nadpisze prawdziwym hashem).
 */
export async function inviteMember(
  requesterEmail: string,
  inviteeEmail: string
): Promise<TeamMember> {
  await assertOwner(requesterEmail);

  const normalized = inviteeEmail.toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) {
    throw new TeamAccessError("Nieprawidłowy adres e-mail.");
  }

  const ws = await getOrCreateWorkspaceForAdmin(requesterEmail);

  const [existing] = await db
    .select({ id: adminUsers.id, workspaceId: adminUsers.workspaceId })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalized))
    .limit(1);

  if (existing) {
    if (existing.workspaceId === ws.id) {
      throw new TeamAccessError("Ta osoba jest już w zespole.");
    }
    throw new TeamAccessError(
      "Ten adres e-mail jest już powiązany z innym kontem."
    );
  }

  const [member] = await db
    .insert(adminUsers)
    .values({
      id: randomUUID(),
      email: normalized,
      // Placeholder — bcrypt hash losowego UUID; nigdy nie da się nim zalogować
      // dopóki właściciel konta nie ustawi hasła przez link z emaila.
      passwordHash: `invite:${randomUUID()}`,
      workspaceId: ws.id,
      role: "member",
    })
    .returning();

  const token = generateResetToken();
  await db.insert(passwordResetTokens).values({
    id: randomUUID(),
    email: normalized,
    token,
    purpose: "admin_invite",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const [wsRow] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, ws.id))
    .limit(1);

  await sendTeamInviteEmail(normalized, token, wsRow?.name ?? "Syntance");

  return { id: member.id, email: member.email, role: "member" };
}

export async function removeMember(
  requesterEmail: string,
  memberId: string
): Promise<void> {
  await assertOwner(requesterEmail);
  const ws = await getOrCreateWorkspaceForAdmin(requesterEmail);

  const [target] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(and(eq(adminUsers.id, memberId), eq(adminUsers.workspaceId, ws.id)))
    .limit(1);

  if (!target) throw new TeamAccessError("Nie znaleziono członka zespołu.");
  if (target.email.toLowerCase().trim() === requesterEmail.toLowerCase().trim()) {
    throw new TeamAccessError("Nie możesz usunąć samego siebie z zespołu.");
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, memberId));
}
