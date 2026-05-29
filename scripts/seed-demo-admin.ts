/**
 * Tworzy konto demo admina dla prezentacji inwestorskich.
 * Użycie: npx tsx --env-file=.env.local scripts/seed-demo-admin.ts
 */
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@syntance.dev";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!DEMO_PASSWORD) {
  console.error("❌ Ustaw DEMO_PASSWORD w .env.local");
  process.exit(1);
}

async function main() {
  const existing = await prisma.adminUser.findUnique({
    where: { email: DEMO_EMAIL },
  });

  if (existing) {
    // Aktualizuj hasło jeśli konto już istnieje
    await prisma.adminUser.update({
      where: { email: DEMO_EMAIL },
      data: { passwordHash: await hashPassword(DEMO_PASSWORD!) },
    });
    console.log(`✅ Hasło konta ${DEMO_EMAIL} zaktualizowane.`);
  } else {
    await prisma.adminUser.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await hashPassword(DEMO_PASSWORD!),
      },
    });
    console.log(`✅ Konto demo ${DEMO_EMAIL} utworzone.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
