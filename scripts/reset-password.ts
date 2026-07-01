import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../db";
import { clientUsers, adminUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npx tsx scripts/reset-password.ts <email> <password>");
  process.exit(1);
}

async function main() {
  const passwordHash = await hashPassword(password);

  const clientResult = await db
    .update(clientUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(clientUsers.email, email))
    .returning({ id: clientUsers.id });

  const adminResult = await db
    .update(adminUsers)
    .set({ passwordHash })
    .where(eq(adminUsers.email, email))
    .returning({ id: adminUsers.id });

  if (clientResult.length === 0 && adminResult.length === 0) {
    console.error(`Brak konta ClientUser/AdminUser dla ${email}`);
    process.exit(1);
  }

  console.log(`Hasło zaktualizowane dla ${email}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
