import "server-only";
import crypto from "crypto";
import { db } from "@/db";
import {
  businessStrategy,
  businessProblems,
  uvp,
  brandPositioning,
  competitors,
  objections,
  notionMappings,
  notionSyncLog,
  projects,
} from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import {
  strategyListItemsToMarkdown,
  WEIGHT_LABELS,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * Okno anti-loop: webhook przychodzący w tym czasie od naszego pushu
 * traktujemy jako echo własnej zmiany i ignorujemy.
 */
const SELF_ECHO_WINDOW_MS = 30_000;

/** Stabilny hash treści (SHA-256) — normalizuje whitespace, by porównywać sens. */
function contentHash(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

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

function priorityToWeight(p: number): StrategyListWeight {
  if (p <= 1) return 1;
  if (p >= 3) return 3;
  return 2;
}

/**
 * Buduje markdown sekcji "Cele biznesowe" z business_problems.
 */
function problemsToMarkdown(
  rows: { problemMd: string; ambitionMd: string | null; priority: number }[]
): string {
  if (rows.length === 0) return "—";
  return rows
    .map((p) => {
      const wLabel = WEIGHT_LABELS[priorityToWeight(p.priority)];
      let block = `- **[${wLabel}]** ${p.problemMd}`;
      if (p.ambitionMd?.trim()) {
        block += `\n  _Ambicja:_ ${p.ambitionMd.trim()}`;
      }
      return block;
    })
    .join("\n\n");
}

/**
 * Buduje markdown sekcji "Obiekcje" z objections.
 */
function objectionsToMarkdown(
  rows: { objectionMd: string; responseMd: string | null; priority: number }[]
): string {
  if (rows.length === 0) return "—";
  return rows
    .map((o) => {
      const wLabel = WEIGHT_LABELS[priorityToWeight(o.priority)];
      let block = `- **[${wLabel}]** ${o.objectionMd}`;
      if (o.responseMd?.trim()) {
        block += `\n  _Odpowiedź:_ ${o.responseMd.trim()}`;
      }
      return block;
    })
    .join("\n\n");
}

/**
 * Buduje markdown sekcji "UVP" z uvp.coreUvpMd + valueAddsJson.
 */
function uvpToMarkdown(row: {
  coreUvpMd: string | null;
  valueAddsJson: string | null;
}): string {
  const parts: string[] = [];
  if (row.coreUvpMd?.trim()) parts.push(`**${row.coreUvpMd.trim()}**`);
  const valueAdds = strategyListItemsToMarkdown(row.valueAddsJson);
  if (valueAdds && valueAdds !== "—") {
    parts.push("### Value adds\n\n" + valueAdds);
  }
  return parts.length > 0 ? parts.join("\n\n") : "—";
}

/**
 * Buduje markdown sekcji "Pozycjonowanie" z brand_positioning.
 */
function positioningToMarkdown(row: {
  axisXLabel: string | null;
  axisYLabel: string | null;
  ourX: number | null;
  ourY: number | null;
  ourLabel: string | null;
  statementMd: string | null;
}): string {
  const parts: string[] = [];
  if (row.statementMd?.trim()) parts.push(row.statementMd.trim());
  const axisLines: string[] = [];
  if (row.axisXLabel) axisLines.push(`- **Oś X:** ${row.axisXLabel}`);
  if (row.axisYLabel) axisLines.push(`- **Oś Y:** ${row.axisYLabel}`);
  if (row.ourLabel || row.ourX !== null) {
    const label = row.ourLabel || "Nasza marka";
    const coords =
      row.ourX !== null && row.ourY !== null
        ? ` (${row.ourX.toFixed(2)}, ${row.ourY.toFixed(2)})`
        : "";
    axisLines.push(`- **Pozycja:** ${label}${coords}`);
  }
  if (axisLines.length > 0) parts.push(axisLines.join("\n"));
  return parts.length > 0 ? parts.join("\n\n") : "—";
}

/**
 * Buduje markdown sekcji "Konkurencja" z listy competitors.
 */
function competitorsToMarkdown(
  rows: {
    name: string;
    url: string | null;
    type: string;
    strengthsMd: string | null;
    weaknessesMd: string | null;
    notesMd: string | null;
  }[]
): string {
  if (rows.length === 0) return "—";
  return rows
    .map((c) => {
      const lines: string[] = [];
      const link = c.url ? ` [${c.url}](${c.url})` : "";
      lines.push(`### ${c.name}${link}  _(${c.type})_`);
      if (c.strengthsMd?.trim())
        lines.push(`**Mocne strony:** ${c.strengthsMd.trim()}`);
      if (c.weaknessesMd?.trim())
        lines.push(`**Słabe strony:** ${c.weaknessesMd.trim()}`);
      if (c.notesMd?.trim()) lines.push(c.notesMd.trim());
      return lines.join("\n\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Push strategii biznesowej projektu do strony Notion.
 * Strona musi istnieć (Notion API integracji nie da prosto utworzyć nowej strony bez parenta).
 * Zapisuje projektowy `notion_page_url` lub korzysta z `projects.notionPageUrl`.
 *
 * Czyta z 5 nowych encji relacyjnych. Sekcje:
 *   - 🎯 Cele biznesowe ← business_problems
 *   - ✨ UVP ← uvp
 *   - 🧭 Pozycjonowanie ← brand_positioning
 *   - 🥊 Konkurencja ← competitors
 *   - 💬 Obiekcje klientów ← objections
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

    const [problemRows, uvpRows, positioningRows, competitorRows, objectionRows] =
      await Promise.all([
        db
          .select()
          .from(businessProblems)
          .where(
            and(
              eq(businessProblems.projectId, projectId),
              isNull(businessProblems.deletedAt)
            )
          )
          .orderBy(asc(businessProblems.orderIdx)),
        db.select().from(uvp).where(eq(uvp.projectId, projectId)).limit(1),
        db
          .select()
          .from(brandPositioning)
          .where(eq(brandPositioning.projectId, projectId))
          .limit(1),
        db
          .select()
          .from(competitors)
          .where(
            and(
              eq(competitors.projectId, projectId),
              isNull(competitors.deletedAt)
            )
          )
          .orderBy(asc(competitors.createdAt)),
        db
          .select()
          .from(objections)
          .where(
            and(
              eq(objections.projectId, projectId),
              isNull(objections.deletedAt)
            )
          )
          .orderBy(asc(objections.orderIdx)),
      ]);

    const pageId = extractPageId(project.notionPageUrl);
    if (!pageId) throw new Error("Nie udało się sparsować Notion page id");

    const sections: { title: string; md: string | null }[] = [
      { title: "🎯 Cele biznesowe", md: problemsToMarkdown(problemRows) },
      {
        title: "✨ UVP",
        md: uvpRows[0] ? uvpToMarkdown(uvpRows[0]) : "—",
      },
      {
        title: "🧭 Pozycjonowanie",
        md: positioningRows[0] ? positioningToMarkdown(positioningRows[0]) : "—",
      },
      { title: "🥊 Konkurencja", md: competitorsToMarkdown(competitorRows) },
      { title: "💬 Obiekcje klientów", md: objectionsToMarkdown(objectionRows) },
    ];

    let allBlocks: NotionBlock[] = [];
    const mdParts: string[] = [];
    for (const s of sections) {
      if (!s.md || !s.md.trim() || s.md === "—") continue;
      allBlocks.push(headingBlock(2, s.title));
      allBlocks = allBlocks.concat(markdownToNotionBlocks(s.md));
      mdParts.push(`## ${s.title}\n\n${s.md}`);
    }

    // Anti-loop: hash dokładnie tej treści, którą wypychamy do Notion.
    const pushHash = contentHash(mdParts.join("\n\n"));

    await clearPageChildren(pageId);
    await appendBlocks(pageId, allBlocks);

    const now = new Date();
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
          lastSyncedAt: now,
          lastSyncedDirection: "push",
          lastPushHash: pushHash,
          lastPushedAt: now,
        })
        .where(eq(notionMappings.id, existingMapping[0].id));
    } else {
      await db.insert(notionMappings).values({
        entityType: "business_strategy",
        entityId: projectId,
        projectId,
        notionUrl: project.notionPageUrl,
        lastSyncedAt: now,
        lastSyncedDirection: "push",
        lastPushHash: pushHash,
        lastPushedAt: now,
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

    // ── Anti-loop #1: echo własnego pushu ──────────────────────────────────
    // Notion odpala content_updated tuż po naszym pushu — jeśli mieścimy się
    // w oknie SELF_ECHO_WINDOW_MS, to jest nasze echo, nie zmiana klienta.
    const strategyMapping = await db
      .select()
      .from(notionMappings)
      .where(
        and(
          eq(notionMappings.entityType, "business_strategy"),
          eq(notionMappings.entityId, projectId)
        )
      )
      .limit(1);
    const mappingRow = strategyMapping[0];
    if (
      mappingRow?.lastPushedAt &&
      Date.now() - mappingRow.lastPushedAt.getTime() < SELF_ECHO_WINDOW_MS
    ) {
      await db.insert(notionSyncLog).values({
        projectId,
        entityType: "business_strategy",
        entityId: projectId,
        direction: "pull",
        status: "skipped_self_echo",
      });
      return { ok: true, skipped: "self_echo", elapsedMs: Date.now() - start };
    }

    // Pobierz bloki Notion i konwertuj na markdown per sekcję
    const list = (await notionFetch(
      `/blocks/${notionPageId}/children?page_size=100`
    )) as { results: NotionBlock[] };

    const sections = blocksToSections(list.results);

    // ── Anti-loop #2: pomiń zapis, jeśli treść identyczna z naszym pushem ───
    const incomingHash = contentHash(
      [
        sections.goals ?? "",
        sections.uvp ?? "",
        sections.competitors ?? "",
        sections.objections ?? "",
      ].join("\n\n")
    );
    if (mappingRow?.lastPushHash && mappingRow.lastPushHash === incomingHash) {
      await db.insert(notionSyncLog).values({
        projectId,
        entityType: "business_strategy",
        entityId: projectId,
        direction: "pull",
        status: "skipped_no_change",
      });
      return { ok: true, skipped: "no_change", elapsedMs: Date.now() - start };
    }

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

    // Zapisujemy hash i kierunek pulla — kolejny webhook z tą samą treścią
    // zostanie pominięty (anti-loop #2). Nie nadpisujemy lastPushedAt.
    if (mappingRow) {
      await db
        .update(notionMappings)
        .set({
          lastSyncedAt: new Date(),
          lastSyncedDirection: "pull",
          lastPushHash: incomingHash,
        })
        .where(eq(notionMappings.id, mappingRow.id));
    }

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
