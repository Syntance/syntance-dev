import "server-only";
import { db } from "@/db";
import { clientVisitsLog } from "@/db/schema";
import { headers } from "next/headers";

/**
 * Fire-and-forget tracking — nie blokuje renderingu strony.
 * Loguje do client_visits_log, że klient otworzył sekcję projektu.
 */
export async function trackVisit(projectId: string, section: string) {
  // Nie awaitujemy — fire-and-forget
  (async () => {
    try {
      const h = await headers();
      const ua = h.get("user-agent") ?? null;
      const ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;

      await db.insert(clientVisitsLog).values({
        projectId,
        section,
        userAgent: ua,
        ip,
      });
    } catch (err) {
      console.error("[tracking] failed", err);
    }
  })();
}
