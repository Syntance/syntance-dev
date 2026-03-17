import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.Database_POSTGRES_PRISMA_URL ||
  process.env.Database_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE')));
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
