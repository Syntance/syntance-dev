import { getProjectAlerts } from "@/lib/strategy-hub/alerts";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

export const runtime = "nodejs";

/**
 * Faza 15 (M4) — Realtime <5s dla alertów projektu (SSE zamiast pollingu).
 *
 * Zastępuje dwa niezależne pollery (`AlertsToaster` co 60s, `AlertsBell` co 5min)
 * jednym strumieniem: serwer sprawdza alerty co `TICK_MS` i wysyła event tylko
 * gdy skład się zmienił (diff po `id`). Świadome odstępstwo od Supabase Realtime
 * (patrz plan §3) — baza nie jest na Supabase, więc SSE + interwał serwerowy
 * spełnia cel "<5s" bez dodatkowej infrastruktury (LISTEN/NOTIFY, WS gateway).
 */
const TICK_MS = 4_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const encoder = new TextEncoder();
  let lastSignature = "";
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tick = async () => {
        if (closed) return;
        try {
          const alerts = await getProjectAlerts(id);
          const signature = alerts.map((a) => a.id).sort().join(",");
          if (signature !== lastSignature) {
            lastSignature = signature;
            send("alerts", { alerts });
          } else {
            send("ping", { ok: true });
          }
        } catch {
          // best-effort — nie zrywamy strumienia na przejściowym błędzie DB
        }
      };

      await tick();
      const interval = setInterval(() => void tick(), TICK_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // już zamknięty
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
