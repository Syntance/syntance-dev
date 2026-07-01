import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, isNull, isNotNull } from "drizzle-orm";
import { pushBusinessStrategyToNotion } from "@/lib/strategy-hub/notion-sync";

/**
 * Faza 13 — reconciliation cron dla synchronizacji Notion.
 *
 * Webhook (`/notion/webhook`) obsługuje zmiany w czasie rzeczywistym (Notion → app),
 * ale jest zależny od dostarczenia eventu przez Notion (może się zgubić / nie dojść).
 * Ten cron to fallback: raz dziennie wypycha (app → Notion) aktualny stan strategii
 * biznesowej dla wszystkich projektów z podpiętym `notion_page_url`, żeby obie strony
 * nigdy nie rozjechały się na dłużej niż 24h.
 */
function isAuthorized(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return true;
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret === process.env.CRON_SECRET) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(isNull(projects.deletedAt), isNotNull(projects.notionPageUrl)));

  const results: { projectId: string; name: string; ok: boolean; error?: string }[] =
    [];

  for (const p of projectRows) {
    try {
      await pushBusinessStrategyToNotion(p.id);
      results.push({ projectId: p.id, name: p.name, ok: true });
    } catch (err) {
      results.push({
        projectId: p.id,
        name: p.name,
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
