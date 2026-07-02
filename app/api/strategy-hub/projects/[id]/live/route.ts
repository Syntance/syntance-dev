import { NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Realtime (spec: propagacja zmian < 5s do Hub + Dashboard klienta).
 *
 * DB to Neon Postgres (nie Supabase), więc zamiast Supabase Realtime channels: SSE z pollingiem
 * po stronie serwera co 2s po `change_history` (już zapisywanej przez większość
 * ścieżek zapisu przez `trackChange`). Klient trzyma jedno długie połączenie
 * zamiast odpytywać co kilka sekund sam — mniej requestów, ten sam efekt.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      let lastSeen: Date | null = null;
      try {
        const [latest] = await db
          .select({ createdAt: changeHistory.createdAt })
          .from(changeHistory)
          .where(eq(changeHistory.projectId, projectId))
          .orderBy(desc(changeHistory.createdAt))
          .limit(1);
        lastSeen = latest?.createdAt ?? new Date();
      } catch {
        lastSeen = new Date();
      }

      send("ready", { since: lastSeen?.toISOString() });

      const poll = setInterval(async () => {
        if (closed) return;
        try {
          const [latest] = await db
            .select({ createdAt: changeHistory.createdAt, entityType: changeHistory.entityType })
            .from(changeHistory)
            .where(eq(changeHistory.projectId, projectId))
            .orderBy(desc(changeHistory.createdAt))
            .limit(1);

          if (latest && (!lastSeen || latest.createdAt > lastSeen)) {
            lastSeen = latest.createdAt;
            send("changed", { at: latest.createdAt.toISOString(), entityType: latest.entityType });
          } else {
            send("heartbeat", { at: new Date().toISOString() });
          }
        } catch (err) {
          console.error("live poll failed", err);
        }
      }, 2000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(poll);
        try {
          controller.close();
        } catch {
          // już zamknięte
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
