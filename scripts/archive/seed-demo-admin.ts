/**
 * Tworzy konto demo admina dla prezentacji inwestorskich.
 * Użycie: npx tsx --env-file=.env.local scripts/seed-demo-admin.ts
 */
import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@syntance.dev";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!DEMO_PASSWORD) {
  console.error("❌ Ustaw DEMO_PASSWORD w .env.local");
  process.exit(1);
}

async function main() {
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    await db
      .update(adminUsers)
      .set({ passwordHash: await hashPassword(DEMO_PASSWORD!) })
      .where(eq(adminUsers.email, DEMO_EMAIL));
    console.log(`✅ Hasło konta ${DEMO_EMAIL} zaktualizowane.`);
  } else {
    await db.insert(adminUsers).values({
      id: randomUUID(),
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD!),
    });
    console.log(`✅ Konto demo ${DEMO_EMAIL} utworzone.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
