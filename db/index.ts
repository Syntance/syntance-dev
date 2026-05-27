import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrl } from "@/lib/strategy-hub/db-url";

const client = postgres(getDatabaseUrl(), { prepare: false });

export const db = drizzle(client, { schema });

export type Database = typeof db;
