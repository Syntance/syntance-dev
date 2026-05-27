/**
 * Jedno źródło connection stringa — lokalnie i na Vercel (Neon integration).
 * Priorytet: DATABASE_URL → Database_DATABASE_URL (pooled) → unpooled fallback.
 */
export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.Database_DATABASE_URL ||
    process.env.Database_POSTGRES_URL ||
    process.env.Database_POSTGRES_PRISMA_URL ||
    process.env.Database_DATABASE_URL_UNPOOLED;

  if (!url) {
    throw new Error(
      "Brak DATABASE_URL. Ustaw DATABASE_URL lub Database_DATABASE_URL w .env.local (vercel env pull)."
    );
  }

  return url;
}
