import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Rate limit fixed-window na Postgresie (tabela `auth_rate_limits`) — dla
 * wrażliwych endpointów auth (login, request-reset, request-setup). Celowo DB,
 * nie in-memory: licznik przeżywa restart i działa przy wielu instancjach.
 * Atomowy upsert: wygasłe okno resetuje licznik, aktywne inkrementuje.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Po ilu sekundach okno się otworzy — do nagłówka `Retry-After`. */
  retryAfterSec: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const rows = await db.execute<{ count: number; window_start: Date }>(sql`
      INSERT INTO auth_rate_limits ("key", window_start, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        count = CASE
          WHEN auth_rate_limits.window_start <= now() - (${windowMs} * interval '1 millisecond')
            THEN 1
          ELSE auth_rate_limits.count + 1
        END,
        window_start = CASE
          WHEN auth_rate_limits.window_start <= now() - (${windowMs} * interval '1 millisecond')
            THEN now()
          ELSE auth_rate_limits.window_start
        END
      RETURNING count, window_start
    `);
    const row = rows[0];
    if (!row) return { ok: true, retryAfterSec: 0 };

    const windowStart = new Date(row.window_start).getTime();
    const retryAfterSec = Math.max(
      1,
      Math.ceil((windowStart + windowMs - Date.now()) / 1000)
    );
    return { ok: Number(row.count) <= limit, retryAfterSec };
  } catch (err) {
    // Fail-open: awaria limitera nie może zablokować logowania wszystkim.
    // Głośny log zamiast cichego połknięcia — brak limitu to incydent konfiguracji.
    console.error("[rate-limit] check failed, failing open:", err);
    return { ok: true, retryAfterSec: 0 };
  }
}

/**
 * Zeruje licznik (np. po udanym logowaniu), żeby legalne kolejne logowania
 * w tym samym oknie nie zjadały limitu.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM auth_rate_limits WHERE "key" = ${key}`);
  } catch (err) {
    console.error("[rate-limit] reset failed:", err);
  }
}

/**
 * IP klienta z nagłówków proxy (Vercel: pierwszy wpis `x-forwarded-for`).
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
