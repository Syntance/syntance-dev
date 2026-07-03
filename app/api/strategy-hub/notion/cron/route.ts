import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, isNull, isNotNull } from "drizzle-orm";
import { pushBusinessStrategyToNotion } from "@/lib/strategy-hub/notion-sync";
import { isCronAuthorized, cronUnauthorizedResponse } from "@/lib/strategy-hub/api-helpers";

/**
 * Faza 13 — reconciliation cron dla synchronizacji Notion.
 *
 * Webhook (`/notion/webhook`) obsługuje zmiany w czasie rzeczywistym (Notion → app),
 * ale jest zależny od dostarczenia eventu przez Notion (może się zgubić / nie dojść).
 * Ten cron to fallback: raz dziennie wypycha (app → Notion) aktualny stan strategii
 * biznesowej dla wszystkich projektów z podpiętym `notion_page_url`, żeby obie strony
 * nigdy nie rozjechały się na dłużej niż 24h.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorizedResponse();

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
