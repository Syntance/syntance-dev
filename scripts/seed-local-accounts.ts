/**
 * Seeduje konto admina + konto klienta na świeżej, lokalnej bazie deweloperskiej.
 * Zastępuje dawny `prisma/seed.ts` (Faza 16, M2 — wygaszenie Prisma).
 * Użycie: npx tsx --env-file=.env.local scripts/seed-local-accounts.ts
 */
import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminUsers, clientUsers, projectClients, projects } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

async function main() {
  const adminEmail = "admin@syntance.com";
  const adminPassword = "admin123";

  const [existingAdmin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail))
    .limit(1);

  if (!existingAdmin) {
    await db.insert(adminUsers).values({
      id: randomUUID(),
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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
