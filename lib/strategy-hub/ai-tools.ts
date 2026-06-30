import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@/db";
import {
  projects,
  businessStrategy,
  segments,
  kpis,
  userFlows,
  pages,
  seoKeywords,
  strategicDecisions,
  campaigns,
  geoAssets,
  offers,
} from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import {
  serializeStrategyListItems,
  parseStrategyListItems,
  createStrategyListItem,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

// ─── Read project ─────────────────────────────────────────────────────────────

export const readProjectTool = (projectId: string) =>
  tool({
    description:
      "Czyta pełne dane projektu z bazy: informacje podstawowe, strategię biznesową (cele, UVP, konkurencja, obiekcje), segmenty, KPI, user flows, strony, frazy SEO.",
    parameters: z.object({}),
    execute: async () => {
      const [proj, strat, segs, kpiRows, flows, pageRows, kwRows] =
        await Promise.all([
          db
            .select()
            .from(projects)
            .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
            .limit(1),
          db
            .select()
            .from(businessStrategy)
            .where(eq(businessStrategy.projectId, projectId))
            .limit(1),
          db
            .select()
            .from(segments)
            .where(
              and(
                eq(segments.projectId, projectId),
                isNull(segments.deletedAt)
              )
            ),
          db
            .select()
            .from(kpis)
            .where(
              and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))
            ),
          db
            .select()
            .from(userFlows)
            .where(
              and(
                eq(userFlows.projectId, projectId),
                isNull(userFlows.deletedAt)
              )
            ),
          db
            .select()
            .from(pages)
            .where(
              and(eq(pages.projectId, projectId), isNull(pages.deletedAt))
            ),
          db
            .select()
            .from(seoKeywords)
            .where(
              and(
                eq(seoKeywords.projectId, projectId),
                isNull(seoKeywords.deletedAt)
              )
            ),
        ]);

      const project = proj[0];
      if (!project) return { error: "Projekt nie istnieje" };

      const s = strat[0];
      return {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          status: project.status,
          domain: project.domain,
          description: project.description,
          clientName: project.clientName,
        },
        businessStrategy: s
          ? {
              goals: parseStrategyListItems(s.goalsMd),
              uvp: parseStrategyListItems(s.uvpMd),
              competitors: s.competitorsMd,
              objections: parseStrategyListItems(s.objectionsMd),
            }
          : null,
        segments: segs.map((sg) => ({
          id: sg.id,
          name: sg.name,
          persona: sg.persona,
          jtbd: sg.jtbd,
          problem: sg.problem,
          uvpText: sg.uvpText,
          priority: sg.priority,
        })),
        kpis: kpiRows.map((k) => ({
          id: k.id,
          name: k.name,
          target: k.target,
          actual: k.actual,
          unit: k.unit,
          category: k.category,
        })),
        userFlows: flows.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          status: f.status,
          conversionGoal: f.conversionGoal,
        })),
        pages: pageRows.map((p) => ({
          id: p.id,
          name: p.name,
          urlPath: p.urlPath,
          type: p.type,
          cta: p.cta,
          status: p.status,
        })),
        seoKeywords: kwRows.map((k) => ({
          id: k.id,
          phrase: k.phrase,
          intent: k.intent,
          volume: k.volume,
          priority: k.priority,
          status: k.status,
        })),
      };
    },
  });

// ─── Update business strategy ─────────────────────────────────────────────────

export const updateBusinessStrategyTool = (projectId: string) =>
  tool({
    description:
      "Aktualizuje sekcję strategii biznesowej projektu. Dla goals, uvp i objections: lista obiektów [{text, note?, weight: 1|2|3}]. Dla competitors: string markdown.",
    parameters: z.object({
      section: z.enum(["goals", "uvp", "competitors", "objections"]),
      items: z
        .array(
          z.object({
            text: z.string(),
            note: z.string().optional().default(""),
            weight: z.number().int().min(1).max(3).optional().default(2),
          })
        )
        .optional()
        .describe("Dla goals/uvp/objections — lista calloutów"),
      markdown: z
        .string()
        .optional()
        .describe("Dla competitors — tekst markdown"),
    }),
    execute: async ({ section, items, markdown }) => {
      const fieldMap = {
        goals: "goalsMd",
        uvp: "uvpMd",
        competitors: "competitorsMd",
        objections: "objectionsMd",
      } as const;

      let value: string;
      if (section === "competitors") {
        value = markdown ?? "";
      } else {
        const listItems = (items ?? []).map((item) => ({
          ...createStrategyListItem(item.text),
          note: item.note ?? "",
          weight: (item.weight ?? 2) as StrategyListWeight,
        }));
        value = serializeStrategyListItems(listItems);
      }

      const field = fieldMap[section];
      const existing = await db
        .select({ projectId: businessStrategy.projectId })
        .from(businessStrategy)
        .where(eq(businessStrategy.projectId, projectId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(businessStrategy)
          .set({ [field]: value, updatedAt: new Date() })
          .where(eq(businessStrategy.projectId, projectId));
      } else {
        await db
          .insert(businessStrategy)
          .values({ projectId, [field]: value });
      }

      return { ok: true, section, updated: value.length };
    },
  });

// ─── Upsert segment ───────────────────────────────────────────────────────────

export const upsertSegmentTool = (projectId: string) =>
  tool({
    description: "Tworzy lub aktualizuje segment docelowy. Podaj id aby zaktualizować istniejący.",
    parameters: z.object({
      id: z.string().uuid().optional().describe("UUID istniejącego segmentu (pomiń aby stworzyć nowy)"),
      name: z.string().min(1),
      persona: z.string().optional(),
      jtbd: z.string().optional().describe("Jobs To Be Done"),
      problem: z.string().optional(),
      uvpText: z.string().optional(),
    }),
    execute: async ({ id, name, ...rest }) => {
      if (id) {
        await db.update(segments).set({ name, ...rest }).where(eq(segments.id, id));
        return { ok: true, id, action: "updated" };
      }
      const rows = await db
        .insert(segments)
        .values({ projectId, name, ...rest })
        .returning({ id: segments.id });
      return { ok: true, id: rows[0]?.id, action: "created" };
    },
  });

// ─── Upsert KPI ───────────────────────────────────────────────────────────────

export const upsertKpiTool = (projectId: string) =>
  tool({
    description: "Tworzy lub aktualizuje KPI projektu.",
    parameters: z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      target: z.string().optional(),
      unit: z.string().optional(),
      category: z.string().optional(),
    }),
    execute: async ({ id, name, ...rest }) => {
      if (id) {
        await db.update(kpis).set({ name, ...rest }).where(eq(kpis.id, id));
        return { ok: true, id, action: "updated" };
      }
      const rows = await db
        .insert(kpis)
        .values({ projectId, name, ...rest })
        .returning({ id: kpis.id });
      return { ok: true, id: rows[0]?.id, action: "created" };
    },
  });

// ─── Web search (Tavily) ──────────────────────────────────────────────────────

export const webSearchTool = tool({
  description:
    "Przeszukuje internet w celu uzyskania aktualnych informacji. Użyj do znalezienia danych o rynku, konkurencji, trendach.",
  parameters: z.object({
    query: z.string().describe("Zapytanie wyszukiwania po polsku lub angielsku"),
    depth: z
      .enum(["basic", "advanced"])
      .optional()
      .default("basic")
      .describe("basic = szybkie, advanced = dokładne (deep research)"),
    maxResults: z.number().int().min(1).max(10).optional().default(5),
  }),
  execute: async ({ query, depth, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        error: "TAVILY_API_KEY nie jest ustawiony. Dodaj go do zmiennych środowiskowych.",
      };
    }

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: depth,
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { error: `Tavily API error: ${res.status}` };
    }

    const data = (await res.json()) as {
      answer?: string;
      results?: {
        title: string;
        url: string;
        content: string;
        score: number;
      }[];
    };

    return {
      answer: data.answer,
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content.slice(0, 300),
        score: r.score,
      })),
    };
  },
});

// ─── Read Notion ──────────────────────────────────────────────────────────────

export const readNotionTool = tool({
  description:
    "Przeszukuje i czyta strony z Notion workspace. Użyj do pobrania notatek, briefów, dokumentów projektowych.",
  parameters: z.object({
    query: z.string().describe("Fraza do wyszukania w Notion"),
    pageId: z
      .string()
      .optional()
      .describe("Opcjonalny ID konkretnej strony Notion"),
  }),
  execute: async ({ query, pageId }) => {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      return {
        error: "NOTION_TOKEN nie jest ustawiony. Skonfiguruj integrację Notion.",
      };
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    if (pageId) {
      const [blockRes, pageRes] = await Promise.all([
        fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
          headers,
          signal: AbortSignal.timeout(10_000),
        }),
        fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          headers,
          signal: AbortSignal.timeout(10_000),
        }),
      ]);

      if (!blockRes.ok) return { error: `Notion API error: ${blockRes.status}` };

      const blocks = (await blockRes.json()) as { results?: unknown[] };
      const page = pageRes.ok ? await pageRes.json() : null;

      const pageTitle =
        page?.properties?.title?.title?.[0]?.plain_text ??
        page?.properties?.Name?.title?.[0]?.plain_text ??
        "Strona Notion";

      const text = extractNotionText(blocks.results ?? []);
      return { pageId, title: pageTitle, content: text.slice(0, 4000) };
    }

    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, page_size: 5, filter: { value: "page", property: "object" } }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!searchRes.ok) return { error: `Notion search error: ${searchRes.status}` };

    const search = (await searchRes.json()) as {
      results?: {
        id: string;
        properties?: Record<string, unknown>;
      }[];
    };

    const pages = (search.results ?? []).map((p) => {
      const titleProp =
        (p.properties?.title as { title?: { plain_text?: string }[] } | undefined)
          ?.title?.[0]?.plain_text ??
        (p.properties?.Name as { title?: { plain_text?: string }[] } | undefined)
          ?.title?.[0]?.plain_text ??
        "Brak tytułu";
      return { id: p.id, title: titleProp };
    });

    return { query, pages };
  },
});

function extractNotionText(blocks: unknown[]): string {
  return blocks
    .map((block) => {
      const b = block as {
        type?: string;
        [key: string]: unknown;
      };
      const type = b.type;
      const rich =
        (b[type ?? ""] as { rich_text?: { plain_text?: string }[] } | undefined)
          ?.rich_text ?? [];
      return rich.map((r) => r.plain_text ?? "").join("");
    })
    .filter(Boolean)
    .join("\n");
}

// ─── Decisions / campaigns / offers ───────────────────────────────────────────

export const listStrategicDecisionsTool = (projectId: string) =>
  tool({
    description: "Lista decyzji strategicznych projektu z uzasadnieniem.",
    parameters: z.object({}),
    execute: async () => {
      const rows = await db
        .select({
          id: strategicDecisions.id,
          title: strategicDecisions.title,
          status: strategicDecisions.status,
          reasonMd: strategicDecisions.reasonMd,
        })
        .from(strategicDecisions)
        .where(
          and(
            eq(strategicDecisions.projectId, projectId),
            isNull(strategicDecisions.deletedAt)
          )
        );
      return { decisions: rows };
    },
  });

export const listCampaignsTool = (projectId: string) =>
  tool({
    description: "Lista kampanii marketingowych projektu.",
    parameters: z.object({}),
    execute: async () => {
      const rows = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          stage: campaigns.stage,
          status: campaigns.status,
          goal: campaigns.goal,
        })
        .from(campaigns)
        .where(
          and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))
        );
      return { campaigns: rows };
    },
  });

export const listGeoAndOffersTool = (projectId: string) =>
  tool({
    description: "Assety GEO/AEO oraz oferty produktowe projektu.",
    parameters: z.object({}),
    execute: async () => {
      const [geo, offerRows] = await Promise.all([
        db
          .select({ id: geoAssets.id, type: geoAssets.type, status: geoAssets.status })
          .from(geoAssets)
          .where(
            and(eq(geoAssets.projectId, projectId), isNull(geoAssets.deletedAt))
          ),
        db
          .select({ id: offers.id, name: offers.name, type: offers.type })
          .from(offers)
          .where(
            and(eq(offers.projectId, projectId), isNull(offers.deletedAt))
          ),
      ]);
      return { geoAssets: geo, offers: offerRows };
    },
  });

// ─── Tool registry ────────────────────────────────────────────────────────────

export type ChatToolOptions = {
  webSearch: boolean;
  notionRead: boolean;
};

export function buildChatTools(projectId: string, options: ChatToolOptions): ToolSet {
  const tools: ToolSet = {
    read_project: readProjectTool(projectId) as ToolSet[string],
    update_business_strategy: updateBusinessStrategyTool(projectId) as ToolSet[string],
    upsert_segment: upsertSegmentTool(projectId) as ToolSet[string],
    upsert_kpi: upsertKpiTool(projectId) as ToolSet[string],
    list_decisions: listStrategicDecisionsTool(projectId) as ToolSet[string],
    list_campaigns: listCampaignsTool(projectId) as ToolSet[string],
    list_geo_offers: listGeoAndOffersTool(projectId) as ToolSet[string],
  };

  if (options.webSearch) {
    tools.web_search = webSearchTool as ToolSet[string];
  }

  if (options.notionRead) {
    tools.read_notion = readNotionTool as ToolSet[string];
  }

  return tools;
}
