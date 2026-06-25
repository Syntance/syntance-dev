import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword } from "../lib/auth";
import { getDatabaseUrl } from "../lib/strategy-hub/db-url";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npx tsx scripts/reset-password.ts <email> <password>");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  const passwordHash = await hashPassword(password);

  await prisma.clientUser.update({
    where: { email },
    data: { passwordHash },
  });

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (admin) {
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash },
    });
  }

  console.log(`Hasło zaktualizowane dla ${email}`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
