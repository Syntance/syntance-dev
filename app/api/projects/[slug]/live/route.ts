import { NextRequest } from "next/server";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Wariant `/live` dla dashboardu klienta (sesja klienta, nie Strategy Hub admin —
 * stąd osobny route zamiast `requireProjectAccess`). Ta sama logika SSE co
 * `strategy-hub/projects/[id]/live`; patrz tamten plik po komentarz projektowy.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getClientSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { slug } = await params;
  let projectId: string;
  try {
    const project = await getProjectBySlugForUser(slug, session.email);
    if (!project) return new Response("Not found", { status: 404 });
    projectId = project._id;
  } catch {
    return new Response("Not found", { status: 404 });
  }

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
            .select({ createdAt: changeHistory.createdAt })
            .from(changeHistory)
            .where(eq(changeHistory.projectId, projectId))
            .orderBy(desc(changeHistory.createdAt))
            .limit(1);

          if (latest && (!lastSeen || latest.createdAt > lastSeen)) {
            lastSeen = latest.createdAt;
            send("changed", { at: latest.createdAt.toISOString() });
          } else {
            send("heartbeat", { at: new Date().toISOString() });
          }
        } catch (err) {
          console.error("client live poll failed", err);
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
