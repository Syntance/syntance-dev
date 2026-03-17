import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/syntance_dev",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "admin@syntance.com";
  const adminPassword = "admin123";

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
      },
    });
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("Admin already exists");
  }

  const clientEmail = "klient@example.com";
  const clientPassword = "klient123";

  const existingClient = await prisma.clientUser.findUnique({
    where: { email: clientEmail },
  });

  if (!existingClient) {
    await prisma.clientUser.create({
      data: {
        email: clientEmail,
        name: "Jan Kowalski",
        passwordHash: await bcrypt.hash(clientPassword, 12),
      },
    });
    console.log(`Client created: ${clientEmail} / ${clientPassword}`);
    console.log(
      "Remember to create a project in Sanity Studio with this email!"
    );
  } else {
    console.log("Client already exists");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
