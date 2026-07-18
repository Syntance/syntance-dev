/**
 * Walidacja zmiennych środowiskowych przy starcie serwera (instrumentation.ts).
 * Fail-fast na produkcji: brakujący sekret ma wywalić deploy, nie pierwszą
 * requestującą osobę. Lokalnie tylko ostrzega — dev działa bez pełnego env.
 */

export function assertServerEnv(): void {
  const missing: string[] = [];

  // getDatabaseUrl() akceptuje kilka aliasów (Neon/Vercel) — patrz db-url.ts.
  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL ||
      process.env.Database_DATABASE_URL ||
      process.env.Database_POSTGRES_URL ||
      process.env.Database_POSTGRES_PRISMA_URL ||
      process.env.Database_DATABASE_URL_UNPOOLED
  );
  if (!hasDatabaseUrl) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");

  if (process.env.NODE_ENV !== "production") {
    if (missing.length > 0) {
      console.warn(
        `[env] Brak zmiennych (dev, tylko ostrzeżenie): ${missing.join(", ")}`
      );
    }
    return;
  }

  if (missing.length > 0) {
    throw new Error(
      `Brak wymaganych zmiennych środowiskowych na produkcji: ${missing.join(", ")}`
    );
  }
  if (!process.env.CRON_SECRET) {
    // Fail-closed w isCronAuthorized: bez sekretu crony dostają 401 na prod.
    console.warn(
      "[env] CRON_SECRET nie jest ustawiony — endpointy cron będą odrzucać żądania (401)."
    );
  }
}
