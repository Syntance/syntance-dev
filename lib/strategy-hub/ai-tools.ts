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
  purchaseStages,
  funnelElements,
  competitors,
  brandPositioning,
  channels,
  channelActivityPlan,
  objections,
  uvp,
  copyGuidelines,
} from "@/db/schema";
import { eq, isNull, and, inArray, desc } from "drizzle-orm";
import {
  serializeStrategyListItems,
  parseStrategyListItems,
  createStrategyListItem,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

// ─── Read project ─────────────────────────────────────────────────────────────

const readProjectTool = (projectId: string) =>
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

const updateBusinessStrategyTool = (projectId: string) =>
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

const upsertSegmentTool = (projectId: string) =>
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

const upsertKpiTool = (projectId: string) =>
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

const webSearchTool = tool({
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

const readNotionTool = tool({
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

const listStrategicDecisionsTool = (projectId: string) =>
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

const listCampaignsTool = (projectId: string) =>
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

const listGeoAndOffersTool = (projectId: string) =>
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

// ─── Sugestie i analizy (2.0) — 7 narzędzi AI-workflow ze spec ────────────────
//
// Każda funkcja `*Context` zbiera dane (read-only) i zwraca `instruction` —
// samą propozycję generuje wywołujący model (Claude w Sidekicku lub Notion AI
// przez MCP). Jedna implementacja, dwóch konsumentów: `tool()` niżej (AI SDK
// / chat Sidekick) i `lib/strategy-hub/mcp/server.ts` (Notion AI przez MCP).

/** hub_suggest_segments — kontekst do zaproponowania segmentów. */
export async function suggestSegmentsContext(projectId: string) {
  const [proj, strat, existing, comp] = await Promise.all([
    db
      .select({ name: projects.name, description: projects.description, domain: projects.domain })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ goalsMd: businessStrategy.goalsMd, uvpMd: businessStrategy.uvpMd })
      .from(businessStrategy)
      .where(eq(businessStrategy.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ name: segments.name, persona: segments.personaName })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({ name: competitors.name, type: competitors.type })
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
  ]);
  return {
    project: proj ?? null,
    goalsMd: strat?.goalsMd ?? null,
    uvpMd: strat?.uvpMd ?? null,
    existingSegments: existing,
    competitors: comp,
    instruction:
      "Zaproponuj 1–3 segmenty, których jeszcze nie ma. Dla każdego: nazwa, persona, JTBD, główny problem, priorytet i szacunkowy % przychodów.",
  };
}

const suggestSegmentsTool = (projectId: string) =>
  tool({
    description:
      "Zbiera kontekst (branża, problemy biznesowe, UVP, konkurencja, istniejące segmenty) aby zaproponować 1–3 nowe segmenty klientów z personą, JTBD i priorytetem. Wywołaj gdy użytkownik prosi o pomysły na segmenty.",
    parameters: z.object({}),
    execute: async () => suggestSegmentsContext(projectId),
  });

/** hub_suggest_funnel — kontekst do zaproponowania elementów lejka. */
export async function suggestFunnelContext(projectId: string, segmentId?: string) {
  const segConds = [eq(segments.projectId, projectId), isNull(segments.deletedAt)];
  if (segmentId) segConds.push(eq(segments.id, segmentId));
  const segRows = await db
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(and(...segConds));

  const segIds = segRows.map((s) => s.id);
  const stageRows = segIds.length
    ? await db
        .select({
          id: purchaseStages.id,
          segmentId: purchaseStages.segmentId,
          name: purchaseStages.name,
          phase: purchaseStages.phase,
        })
        .from(purchaseStages)
        .where(
          and(
            inArray(purchaseStages.segmentId, segIds),
            isNull(purchaseStages.deletedAt)
          )
        )
    : [];

  const stageIds = stageRows.map((s) => s.id);
  const elementRows = stageIds.length
    ? await db
        .select({
          stageId: funnelElements.stageId,
          name: funnelElements.name,
        })
        .from(funnelElements)
        .where(
          and(
            inArray(funnelElements.stageId, stageIds),
            isNull(funnelElements.deletedAt)
          )
        )
    : [];

  return {
    segments: segRows,
    stages: stageRows,
    elements: elementRows,
    phases: ["TOFU", "MOFU", "BOFU", "retention"],
    instruction:
      "Dla każdego segmentu sprawdź, których faz brakuje lub które mają < 3 elementy. Zaproponuj konkretne elementy lejka (treść, format, CTA, kanał) dla brakujących miejsc.",
  };
}

const suggestFunnelTool = (projectId: string) =>
  tool({
    description:
      "Zbiera kontekst lejka (segmenty, etapy zakupu i istniejące elementy) aby zaproponować brakujące elementy lejka per faza (TOFU/MOFU/BOFU/retencja). Wywołaj gdy użytkownik prosi o propozycję lejka lub pyta czego brakuje w lejku.",
    parameters: z.object({
      segmentId: z.string().uuid().optional().describe("Ogranicz do jednego segmentu"),
    }),
    execute: async ({ segmentId }) => suggestFunnelContext(projectId, segmentId),
  });

/** hub_suggest_channel_plan — kontekst do zaproponowania matrycy kanałów. */
export async function suggestChannelPlanContext(
  projectId: string,
  segmentId?: string,
  monthlyBudget?: number
) {
  const segConds = [eq(segments.projectId, projectId), isNull(segments.deletedAt)];
  if (segmentId) segConds.push(eq(segments.id, segmentId));
  const [segRows, channelRows] = await Promise.all([
    db
      .select({ id: segments.id, name: segments.name, priority: segments.priority })
      .from(segments)
      .where(and(...segConds))
      .orderBy(desc(segments.priority)),
    db
      .select({ id: channels.id, name: channels.name, type: channels.type, costMonthly: channels.costMonthly })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
  ]);

  const segIds = segRows.map((s) => s.id);
  const stageRows = segIds.length
    ? await db
        .select({ segmentId: purchaseStages.segmentId, phase: purchaseStages.phase })
        .from(purchaseStages)
        .where(and(inArray(purchaseStages.segmentId, segIds), isNull(purchaseStages.deletedAt)))
    : [];

  const existingPlan = await db
    .select({
      channelId: channelActivityPlan.channelId,
      segmentId: channelActivityPlan.segmentId,
      stage: channelActivityPlan.stage,
    })
    .from(channelActivityPlan)
    .where(isNull(channelActivityPlan.deletedAt));

  return {
    segments: segRows,
    channels: channelRows,
    phasesPerSegment: stageRows,
    existingActivity: existingPlan,
    monthlyBudget: monthlyBudget ?? null,
    instruction:
      "Zaproponuj matrycę kanał × segment × etap (co publikować, cadence, budżet miesięczny) dla par segment+etap bez żadnej aktywności — priorytetyzuj segmenty o wyższym priorytecie i mieść się w podanym budżecie, jeśli podany.",
  };
}

const suggestChannelPlanTool = (projectId: string) =>
  tool({
    description:
      "Zbiera segmenty, kanały i istniejący plan działań aby zaproponować brakujące pozycje w matrycy kanał × segment × etap. Wywołaj gdy użytkownik prosi o plan kanałów lub pyta gdzie promować dany segment.",
    parameters: z.object({
      segmentId: z.string().uuid().optional().describe("Ogranicz do jednego segmentu"),
      monthlyBudget: z.number().int().optional().describe("Miesięczny budżet do rozdysponowania (PLN)"),
    }),
    execute: async ({ segmentId, monthlyBudget }) =>
      suggestChannelPlanContext(projectId, segmentId, monthlyBudget),
  });

/** hub_suggest_objections — kontekst do zaproponowania obiekcji z dowodem. */
export async function suggestObjectionsContext(projectId: string, segmentId?: string) {
  const segConds = [eq(segments.projectId, projectId), isNull(segments.deletedAt)];
  if (segmentId) segConds.push(eq(segments.id, segmentId));
  const [segRows, existingObjections, compRows] = await Promise.all([
    db
      .select({ id: segments.id, name: segments.name, problemMd: segments.problemMd })
      .from(segments)
      .where(and(...segConds)),
    db
      .select({ segmentId: objections.segmentId, objectionMd: objections.objectionMd })
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt))),
    db
      .select({ name: competitors.name, weaknessesMd: competitors.weaknessesMd })
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
  ]);

  return {
    segments: segRows,
    existingObjections,
    competitors: compRows,
    instruction:
      "Dla każdego segmentu zaproponuj 3–5 obiekcji jeszcze nieujętych — każda z odpowiedzią i konkretnym dowodem (case study, statystyka, opinia). Nie powtarzaj istniejących obiekcji.",
  };
}

const suggestObjectionsTool = (projectId: string) =>
  tool({
    description:
      "Zbiera segment, jego problem oraz istniejące obiekcje i słabości konkurencji aby zaproponować nowe obiekcje z odpowiedzią i dowodem. Wywołaj gdy użytkownik prosi o obiekcje dla segmentu.",
    parameters: z.object({
      segmentId: z.string().uuid().optional().describe("Ogranicz do jednego segmentu"),
    }),
    execute: async ({ segmentId }) => suggestObjectionsContext(projectId, segmentId),
  });

/** hub_analyze_strategy — audyt spójności strategii. */
export async function analyzeStrategyContext(projectId: string) {
  const [segRows, kpiRows, pageRows, flowRows, chRows, offerRows] =
    await Promise.all([
      db
        .select({ id: segments.id, name: segments.name })
        .from(segments)
        .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
      db
        .select({ name: kpis.name, target: kpis.target, actual: kpis.actual })
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
      db
        .select({ urlPath: pages.urlPath })
        .from(pages)
        .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
      db
        .select({ name: userFlows.name })
        .from(userFlows)
        .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
      db
        .select({ name: channels.name })
        .from(channels)
        .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
      db
        .select({ name: offers.name })
        .from(offers)
        .where(and(eq(offers.projectId, projectId), isNull(offers.deletedAt))),
    ]);

  const segIds = segRows.map((s) => s.id);
  const stageCount = segIds.length
    ? await db
        .select({ segmentId: purchaseStages.segmentId })
        .from(purchaseStages)
        .where(
          and(
            inArray(purchaseStages.segmentId, segIds),
            isNull(purchaseStages.deletedAt)
          )
        )
    : [];

  const segmentsWithoutFunnel = segRows.filter(
    (s) => !stageCount.some((st) => st.segmentId === s.id)
  );

  return {
    counts: {
      segments: segRows.length,
      kpis: kpiRows.length,
      pages: pageRows.length,
      flows: flowRows.length,
      channels: chRows.length,
      offers: offerRows.length,
    },
    segmentsWithoutFunnel: segmentsWithoutFunnel.map((s) => s.name),
    kpisWithoutActual: kpiRows.filter((k) => !k.actual).map((k) => k.name),
    instruction:
      "Wskaż luki (segmenty bez lejka, KPI bez wartości, brak kanałów/stron), sprzeczności i 3 najważniejsze rekomendacje podnoszące Health Score.",
  };
}

const analyzeStrategyTool = (projectId: string) =>
  tool({
    description:
      "Audytuje spójność strategii: zbiera przekrój danych ze wszystkich modułów (segmenty, lejek, kanały, KPI, strony, oferty) aby wykryć luki, sprzeczności i brakujące powiązania. Wywołaj gdy użytkownik pyta czy strategia jest spójna lub prosi o audyt.",
    parameters: z.object({}),
    execute: async () => analyzeStrategyContext(projectId),
  });

/** hub_compare_competitors — porównanie pozycjonowania z konkurencją. */
export async function compareCompetitorsContext(projectId: string, competitorId?: string) {
  const pos = await db
    .select({
      axisXLabel: brandPositioning.axisXLabel,
      axisYLabel: brandPositioning.axisYLabel,
      ourX: brandPositioning.ourX,
      ourY: brandPositioning.ourY,
      ourLabel: brandPositioning.ourLabel,
      statementMd: brandPositioning.statementMd,
    })
    .from(brandPositioning)
    .where(eq(brandPositioning.projectId, projectId))
    .limit(1)
    .then((r) => r[0]);

  const compConds = [
    eq(competitors.projectId, projectId),
    isNull(competitors.deletedAt),
  ];
  if (competitorId) compConds.push(eq(competitors.id, competitorId));
  const comp = await db
    .select({
      name: competitors.name,
      type: competitors.type,
      strengthsMd: competitors.strengthsMd,
      weaknessesMd: competitors.weaknessesMd,
      pricingMd: competitors.pricingMd,
      quadrantX: competitors.quadrantX,
      quadrantY: competitors.quadrantY,
    })
    .from(competitors)
    .where(and(...compConds));

  return {
    positioning: pos ?? null,
    competitors: comp,
    instruction:
      "Porównaj naszą pozycję z konkurentami na obu osiach quadrantu, wskaż lukę rynkową i przewagi, których możemy użyć.",
  };
}

const compareCompetitorsTool = (projectId: string) =>
  tool({
    description:
      "Porównuje naszą markę z konkurencją: pozycjonowanie na quadrancie + mocne/słabe strony konkurentów. Wywołaj gdy użytkownik prosi o porównanie z konkurencją.",
    parameters: z.object({
      competitorId: z.string().uuid().optional().describe("Ogranicz do jednego konkurenta"),
    }),
    execute: async ({ competitorId }) => compareCompetitorsContext(projectId, competitorId),
  });

/** hub_generate_page_spec — kontekst do wygenerowania sekcji podstrony. */
export async function generatePageSpecContext(projectId: string, pageId: string) {
  const [page] = await db
    .select({
      id: pages.id,
      name: pages.name,
      roleInFunnel: pages.roleInFunnel,
      cta: pages.cta,
      goal: pages.goal,
      type: pages.type,
    })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .limit(1);
  if (!page) return { error: "Podstrona nie znaleziona" };

  const [objectionRows, uvpRow, copyRow] = await Promise.all([
    db
      .select({ objectionMd: objections.objectionMd, responseMd: objections.responseMd })
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt)))
      .limit(10),
    db
      .select({ coreUvpMd: uvp.coreUvpMd })
      .from(uvp)
      .where(eq(uvp.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ principlesMd: copyGuidelines.principlesMd, doMd: copyGuidelines.doMd })
      .from(copyGuidelines)
      .where(eq(copyGuidelines.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  return {
    page,
    objections: objectionRows,
    uvp: uvpRow?.coreUvpMd ?? null,
    copyGuidelines: copyRow ?? null,
    instruction:
      "Zaproponuj sekcje tej podstrony (Hero, dowód/proof, FAQ, CTA) na podstawie roli w lejku, UVP i obiekcji, które strona powinna adresować. Dla każdej sekcji: cel, krótkie copy, CTA. Trzymaj się wytycznych do copy, jeśli podane.",
  };
}

const generatePageSpecTool = (projectId: string) =>
  tool({
    description:
      "Zbiera rolę podstrony w lejku, UVP, obiekcje i wytyczne copy aby zaproponować sekcje strony z copy. Wywołaj gdy użytkownik prosi o spec sekcji dla podstrony.",
    parameters: z.object({
      pageId: z.string().uuid(),
    }),
    execute: async ({ pageId }) => generatePageSpecContext(projectId, pageId),
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
    suggest_segments: suggestSegmentsTool(projectId) as ToolSet[string],
    suggest_funnel: suggestFunnelTool(projectId) as ToolSet[string],
    suggest_channel_plan: suggestChannelPlanTool(projectId) as ToolSet[string],
    suggest_objections: suggestObjectionsTool(projectId) as ToolSet[string],
    analyze_strategy: analyzeStrategyTool(projectId) as ToolSet[string],
    compare_competitors: compareCompetitorsTool(projectId) as ToolSet[string],
    generate_page_spec: generatePageSpecTool(projectId) as ToolSet[string],
  };

  if (options.webSearch) {
    tools.web_search = webSearchTool as ToolSet[string];
  }

  if (options.notionRead) {
    tools.read_notion = readNotionTool as ToolSet[string];
  }

  return tools;
}
