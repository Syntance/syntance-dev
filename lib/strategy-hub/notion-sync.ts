import "server-only";
import { db } from "@/db";
import {
  businessStrategy,
  notionMappings,
  notionSyncLog,
  projects,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

function token() {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new Error("NOTION_TOKEN nie jest ustawiony");
  return t;
}

/**
 * Minimalny konwerter markdown → bloki Notion.
 * Obsługuje: nagłówki (#, ##, ###), listy (-, *, 1.), paragrafy, puste linie.
 */
export function markdownToNotionBlocks(md: string): NotionBlock[] {
  const lines = md.split("\n");
  const blocks: NotionBlock[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#\s+(.+)$/))) {
      blocks.push(headingBlock(1, m[1]));
    } else if ((m = line.match(/^##\s+(.+)$/))) {
      blocks.push(headingBlock(2, m[1]));
    } else if ((m = line.match(/^###\s+(.+)$/))) {
      blocks.push(headingBlock(3, m[1]));
    } else if ((m = line.match(/^[-*]\s+(.+)$/))) {
      blocks.push(listBlock("bulleted", m[1]));
    } else if ((m = line.match(/^\d+\.\s+(.+)$/))) {
      blocks.push(listBlock("numbered", m[1]));
    } else {
      blocks.push(paragraphBlock(line));
    }
  }

  return blocks;
}

function paragraphBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function headingBlock(level: 1 | 2 | 3, text: string): NotionBlock {
  const key = `heading_${level}` as const;
  return {
    object: "block",
    type: key,
    [key]: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function listBlock(kind: "bulleted" | "numbered", text: string): NotionBlock {
  const key =
    kind === "bulleted" ? "bulleted_list_item" : "numbered_list_item";
  return {
    object: "block",
    type: key,
    [key]: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

async function notionFetch(
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API ${res.status}: ${body}`);
  }
  return res.json();
}

async function clearPageChildren(pageId: string) {
  const list = (await notionFetch(`/blocks/${pageId}/children?page_size=100`)) as {
    results: { id: string }[];
  };
  for (const b of list.results) {
    await notionFetch(`/blocks/${b.id}`, { method: "DELETE" });
  }
}

async function appendBlocks(pageId: string, blocks: NotionBlock[]) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notionFetch(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: blocks.slice(i, i + 100) }),
    });
  }
}

/**
 * Push strategii biznesowej projektu do strony Notion.
 * Strona musi istnieć (Notion API integracji nie da prosto utworzyć nowej strony bez parenta).
 * Zapisuje projektowy `notion_page_url` lub korzysta z `projects.notionPageUrl`.
 */
export async function pushBusinessStrategyToNotion(projectId: string) {
  const start = Date.now();
  try {
    const projRows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    const project = projRows[0];
    if (!project?.notionPageUrl) {
      throw new Error("Brak notion_page_url dla projektu");
    }

    const stratRows = await db
      .select()
      .from(businessStrategy)
      .where(eq(businessStrategy.projectId, projectId))
      .limit(1);
    const strat = stratRows[0];
    if (!strat) throw new Error("Brak strategii biznesowej");

    const pageId = extractPageId(project.notionPageUrl);
    if (!pageId) throw new Error("Nie udało się sparsować Notion page id");

    const sections: { title: string; md: string | null }[] = [
      { title: "🎯 Cele biznesowe", md: strat.goalsMd },
      { title: "✨ UVP", md: strat.uvpMd },
      { title: "🥊 Konkurencja", md: strat.competitorsMd },
      { title: "💬 Obiekcje klientów", md: strat.objectionsMd },
    ];

    let allBlocks: NotionBlock[] = [];
    for (const s of sections) {
      if (!s.md || !s.md.trim()) continue;
      allBlocks.push(headingBlock(2, s.title));
      allBlocks = allBlocks.concat(markdownToNotionBlocks(s.md));
    }

    await clearPageChildren(pageId);
    await appendBlocks(pageId, allBlocks);

    const existingMapping = await db
      .select()
      .from(notionMappings)
      .where(
        and(
          eq(notionMappings.entityType, "business_strategy"),
          eq(notionMappings.entityId, projectId)
        )
      )
      .limit(1);
    if (existingMapping[0]) {
      await db
        .update(notionMappings)
        .set({
          lastSyncedAt: new Date(),
          lastSyncedDirection: "push",
        })
        .where(eq(notionMappings.id, existingMapping[0].id));
    } else {
      await db.insert(notionMappings).values({
        entityType: "business_strategy",
        entityId: projectId,
        projectId,
        notionUrl: project.notionPageUrl,
        lastSyncedAt: new Date(),
        lastSyncedDirection: "push",
      });
    }

    await db.insert(notionSyncLog).values({
      projectId,
      entityType: "business_strategy",
      entityId: projectId,
      direction: "push",
      status: "success",
    });

    return { ok: true, elapsedMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await db.insert(notionSyncLog).values({
      projectId,
      entityType: "business_strategy",
      direction: "push",
      status: "error",
      error: message,
    });
    throw err;
  }
}

function extractPageId(url: string): string | null {
  const clean = url.split("?")[0];
  const match = clean.match(/([a-f0-9]{32})$|([a-f0-9-]{36})$/i);
  if (!match) return null;
  const raw = (match[1] ?? match[2]).replace(/-/g, "");
  if (raw.length !== 32) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(
    12,
    16
  )}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`;
}

/**
 * Pull z Notion — odbiera webhook payload i aktualizuje strategię.
 * Notion wysyła event {page.id, …}. Pobieramy zawartość strony,
 * konwertujemy bloki → markdown i zapisujemy do business_strategy.
 *
 * Mapowanie sekcji robione po nagłówku H2 (te same emoji co w push).
 */
export async function pullFromNotion(notionPageId: string) {
  const start = Date.now();
  try {
    const mapping = await db
      .select()
      .from(notionMappings)
      .where(eq(notionMappings.notionUrl, notionPageId))
      .limit(1);

    // jeśli nie ma mapowania po url — szukamy projektu po notionPageUrl
    let projectId: string | null = mapping[0]?.projectId ?? null;

    if (!projectId) {
      // próba znalezienia po URL projektu
      const all = await db.select().from(projects);
      const proj = all.find(
        (p) =>
          p.notionPageUrl &&
          extractPageId(p.notionPageUrl) === notionPageId.replace(/-/g, "")
      );
      if (!proj) throw new Error("Nie znaleziono projektu dla strony Notion");
      projectId = proj.id;
    }

    // Pobierz bloki Notion i konwertuj na markdown per sekcję
    const list = (await notionFetch(
      `/blocks/${notionPageId}/children?page_size=100`
    )) as { results: NotionBlock[] };

    const sections = blocksToSections(list.results);

    await db
      .insert(businessStrategy)
      .values({
        projectId,
        goalsMd: sections.goals,
        uvpMd: sections.uvp,
        competitorsMd: sections.competitors,
        objectionsMd: sections.objections,
      })
      .onConflictDoUpdate({
        target: businessStrategy.projectId,
        set: {
          goalsMd: sections.goals ?? null,
          uvpMd: sections.uvp ?? null,
          competitorsMd: sections.competitors ?? null,
          objectionsMd: sections.objections ?? null,
          updatedAt: new Date(),
        },
      });

    await db.insert(notionSyncLog).values({
      projectId,
      entityType: "business_strategy",
      entityId: projectId,
      direction: "pull",
      status: "success",
    });

    return { ok: true, elapsedMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await db.insert(notionSyncLog).values({
      direction: "pull",
      status: "error",
      error: message,
    });
    throw err;
  }
}

function richTextToString(rt: unknown): string {
  if (!Array.isArray(rt)) return "";
  return rt
    .map((r) => {
      const item = r as { plain_text?: string };
      return item.plain_text ?? "";
    })
    .join("");
}

function blocksToSections(blocks: NotionBlock[]): {
  goals?: string;
  uvp?: string;
  competitors?: string;
  objections?: string;
} {
  const sections: Record<string, string[]> = {
    goals: [],
    uvp: [],
    competitors: [],
    objections: [],
  };

  const HEADERS: Record<string, keyof typeof sections> = {
    "cele biznesowe": "goals",
    "uvp": "uvp",
    "konkurencja": "competitors",
    "obiekcje klientów": "objections",
    "obiekcje klientow": "objections",
  };

  let current: keyof typeof sections | null = null;

  for (const b of blocks) {
    if (b.type === "heading_2") {
      const h2 = b.heading_2 as { rich_text?: unknown };
      const text = richTextToString(h2.rich_text).toLowerCase();
      current = null;
      for (const [needle, key] of Object.entries(HEADERS)) {
        if (text.includes(needle)) {
          current = key;
          break;
        }
      }
      continue;
    }
    if (!current) continue;

    if (b.type === "paragraph") {
      const p = b.paragraph as { rich_text?: unknown };
      const t = richTextToString(p.rich_text);
      if (t) sections[current].push(t);
    } else if (b.type === "bulleted_list_item") {
      const bl = b.bulleted_list_item as { rich_text?: unknown };
      sections[current].push("- " + richTextToString(bl.rich_text));
    } else if (b.type === "numbered_list_item") {
      const nl = b.numbered_list_item as { rich_text?: unknown };
      sections[current].push("1. " + richTextToString(nl.rich_text));
    } else if (b.type === "heading_3") {
      const h3 = b.heading_3 as { rich_text?: unknown };
      sections[current].push("### " + richTextToString(h3.rich_text));
    }
  }

  return {
    goals: sections.goals.join("\n\n") || undefined,
    uvp: sections.uvp.join("\n\n") || undefined,
    competitors: sections.competitors.join("\n\n") || undefined,
    objections: sections.objections.join("\n\n") || undefined,
  };
}
