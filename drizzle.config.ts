import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url =
  process.env.DATABASE_URL ||
  process.env.Database_DATABASE_URL ||
  process.env.Database_POSTGRES_URL;

if (!url) {
  throw new Error("DATABASE_URL / Database_DATABASE_URL not set");
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
