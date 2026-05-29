/**
 * Tworzy workspace i przykładowy projekt dla konta demo.
 * Użycie: npx tsx --env-file=.env.local scripts/seed-demo-workspace.ts
 */
import { db } from "@/db";
import { workspaces, projects, businessStrategy } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@syntance.dev";

async function main() {
  const normalized = DEMO_EMAIL.toLowerCase().trim();

  // Pobierz lub utwórz workspace demo
  let ws = (
    await db.select().from(workspaces).where(eq(workspaces.ownerEmail, normalized)).limit(1)
  )[0];

  if (!ws) {
    [ws] = await db
      .insert(workspaces)
      .values({
        name: "Demo",
        ownerEmail: normalized,
        ownerId: "00000000-0000-0000-0000-000000000002",
      })
      .returning();
    console.log(`✅ Workspace demo utworzony: ${ws.id}`);
  } else {
    console.log(`ℹ️  Workspace demo już istnieje: ${ws.id}`);
  }

  // Sprawdź czy projekt demo już istnieje
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, ws.id))
    .limit(1);

  if (existing.length > 0) {
    console.log(`ℹ️  Projekt demo już istnieje: ${existing[0].name}`);
    process.exit(0);
  }

  // Utwórz przykładowy projekt dla investora
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: ws.id,
      name: "Syntance",
      slug: "syntance-demo",
      icon: "⚡",
      clientName: "Syntance Sp. z o.o.",
      domain: "syntance.dev",
      description:
        "Platforma do zarządzania strategią dla agencji i consultantów. Demo dla inwestorów.",
      status: "active",
    })
    .returning();

  console.log(`✅ Projekt demo utworzony: ${project.id}`);

  // Inicjuj strategię biznesową
  await db
    .insert(businessStrategy)
    .values({
      projectId: project.id,
      goalsMd:
        "## Cele strategiczne\n- Zbudować platformę SaaS do zarządzania strategią dla agencji\n- Osiągnąć 100 płatnych klientów do końca Q4 2026\n- MRR 50 000 PLN w ciągu 12 miesięcy",
      uvpMd:
        "## Unikalna propozycja wartości\nSyntance to jedyne narzędzie, które łączy strategię biznesową z jej wdrożeniem — w jednym miejscu, z widokiem klienta i narzędziami AI.",
    })
    .onConflictDoNothing();

  console.log("✅ Strategia biznesowa dodana.");
  console.log("\n🎉 Dane demo gotowe! Zaloguj się na demo@syntance.dev");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
