/**
 * Seeduje konto admina + konto klienta na świeżej, lokalnej bazie deweloperskiej.
 * Zastępuje dawny `prisma/seed.ts` (Faza 16, M2 — wygaszenie Prisma).
 * Użycie: npx tsx --env-file=.env.local scripts/seed-local-accounts.ts
 */
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  adminUsers,
  clientUsers,
  organizationMembers,
  organizations,
  projectClients,
  projects,
} from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

/** Slug organizacji z dowolnego tekstu (ten sam kształt co w context.ts). */
function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base.slice(0, 90) || "organizacja";
}

/** Wolny slug — indeks `organizations_slug_uq` jest globalny. */
async function findFreeSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 100; i += 1) {
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

/**
 * Organizacja konta seedowego + JEGO CZŁONKOSTWO.
 *
 * O dostępie admina decyduje wyłącznie wiersz w `organizationMembers` —
 * `organizations.ownerEmail` jest tylko śladem po twórcy, a
 * `adminUsers.organizationId` jest @deprecated. Bez wstawienia członkostwa
 * zaseedowane konto nie zobaczyłoby żadnej organizacji.
 */
async function getOrCreateOrganizationForAdminSeed(
  adminUserId: string,
  email: string
) {
  const normalized = email.toLowerCase().trim();

  const [existing] = await db
    .select({ organization: organizations })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId)
    )
    .where(
      and(
        eq(organizationMembers.adminUserId, adminUserId),
        isNull(organizations.deletedAt)
      )
    )
    .limit(1);

  if (existing) return existing.organization;

  const name = normalized.split("@")[0] ?? "Organizacja";
  const [org] = await db
    .insert(organizations)
    .values({
      name,
      slug: await findFreeSlug(toSlug(name)),
      ownerEmail: normalized,
      ownerId: "00000000-0000-0000-0000-000000000001",
    })
    .returning();

  await db
    .insert(organizationMembers)
    .values({ organizationId: org.id, adminUserId, role: "owner" })
    .onConflictDoNothing();

  console.log(`Organization created for admin: ${org.name} (${org.id})`);
  return org;
}

async function ensureAdminOrganizationProject(
  adminUserId: string,
  adminEmail: string
) {
  const org = await getOrCreateOrganizationForAdminSeed(adminUserId, adminEmail);
  const [existing] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.organizationId, org.id), isNull(projects.deletedAt)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [anyProject] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .limit(1);

  if (anyProject) {
    await db
      .update(projects)
      .set({ organizationId: org.id, updatedAt: new Date() })
      .where(eq(projects.id, anyProject.id));
    console.log(`Assigned project to admin organization: ${anyProject.name}`);
    return anyProject;
  }

  const created = {
    id: randomUUID(),
    name: "E2E Demo",
  };
  await db.insert(projects).values({
    id: created.id,
    organizationId: org.id,
    slug: "e2e-demo",
    name: created.name,
    status: "active",
    updatedAt: new Date(),
  });
  console.log(
    `Created E2E demo project in admin organization: ${created.name}`
  );
  return created;
}

async function main() {
  const adminEmail = "admin@syntance.com";
  const adminPassword = "admin123";

  const [existingAdmin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail))
    .limit(1);

  const adminId = existingAdmin?.id ?? randomUUID();

  if (!existingAdmin) {
    await db.insert(adminUsers).values({
      id: adminId,
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
    });
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("Admin already exists");
  }

  const clientEmail = "klient@example.com";
  const clientPassword = "klient123";

  const [existingClient] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, clientEmail))
    .limit(1);

  if (!existingClient) {
    await db.insert(clientUsers).values({
      id: randomUUID(),
      email: clientEmail,
      name: "Jan Kowalski",
      passwordHash: await hashPassword(clientPassword),
      updatedAt: new Date(),
    });
    console.log(`Client created: ${clientEmail} / ${clientPassword}`);
  } else {
    console.log("Client already exists");
  }

  // Dostęp do co najmniej jednego projektu — wymagane przez login (patrz
  // app/api/auth/login/route.ts, "Brak przypisanych projektów do tego konta")
  // i przez E2E smoke testy (e2e/auth.spec.ts, flow B).
  const [existingAccess] = await db
    .select({ id: projectClients.id })
    .from(projectClients)
    .where(eq(projectClients.email, clientEmail))
    .limit(1);

  if (!existingAccess) {
    const [anyProject] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .limit(1);

    if (anyProject) {
      await db.insert(projectClients).values({
        projectId: anyProject.id,
        email: clientEmail,
      });
      console.log(`Client granted access to project: ${anyProject.name}`);
    } else {
      console.log(
        "Brak projektów w bazie — utwórz projekt, żeby klient mógł się zalogować."
      );
    }
  } else {
    console.log("Client already has project access");
  }

  const e2eProject = await ensureAdminOrganizationProject(adminId, adminEmail);
  const [clientAccess] = await db
    .select({ id: projectClients.id })
    .from(projectClients)
    .where(eq(projectClients.email, clientEmail))
    .limit(1);
  if (!clientAccess) {
    await db.insert(projectClients).values({
      projectId: e2eProject.id,
      email: clientEmail,
    });
    console.log(`Client granted access to project: ${e2eProject.name}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
