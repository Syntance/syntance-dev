/**
 * ARCHIWUM. Tworzy organizację (dawniej „workspace") i przykładowy projekt dla
 * konta demo.
 * Użycie: npx tsx --env-file=.env.local scripts/archive/seed-demo-workspace.ts
 *
 * UWAGA: skrypt NIE nadaje dostępu — po przejściu na organizacje o dostępie
 * admina decyduje wyłącznie wiersz w `organizationMembers`, a `ownerEmail` jest
 * już tylko śladem po twórcy. Żeby konto demo zobaczyło tę organizację, trzeba
 * dopisać członkostwo (patrz scripts/seed-local-accounts.ts). Zostawione bez
 * zmian, bo plik jest archiwalny i nie wchodzi do żadnego pipeline'u.
 */
import { db } from "@/db";
import { organizations, projects, businessStrategy } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@syntance.dev";

async function main() {
  const normalized = DEMO_EMAIL.toLowerCase().trim();

  // Pobierz lub utwórz organizację demo
  let org = (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerEmail, normalized))
      .limit(1)
  )[0];

  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        name: "Demo",
        slug: "demo",
        ownerEmail: normalized,
        ownerId: "00000000-0000-0000-0000-000000000002",
      })
      .returning();
    console.log(`✅ Organizacja demo utworzona: ${org.id}`);
  } else {
    console.log(`ℹ️  Organizacja demo już istnieje: ${org.id}`);
  }

  // Sprawdź czy projekt demo już istnieje
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id))
    .limit(1);

  if (existing.length > 0) {
    console.log(`ℹ️  Projekt demo już istnieje: ${existing[0].name}`);
    process.exit(0);
  }

  // Utwórz przykładowy projekt dla investora
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
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
