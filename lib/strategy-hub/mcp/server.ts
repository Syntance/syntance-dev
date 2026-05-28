import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/db";
import {
  projects,
  segments,
  kpis,
  userFlows,
  businessStrategy,
  businessProblems,
  uvp,
  brandPositioning,
  competitors,
  objections,
  pages,
  seoKeywords,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createStrategyHubMcpServer() {
  const server = new McpServer(
    { name: "syntance-strategy-hub", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "list_projects",
    {
      description: "Zwraca wszystkie aktywne projekty z bazy Strategy Hub.",
      inputSchema: z.object({}),
    },
    async () => {
      const rows = await db
        .select()
        .from(projects)
        .where(isNull(projects.deletedAt));
      return jsonText(rows);
    }
  );

  server.registerTool(
    "get_project",
    {
      description: "Zwraca dane pojedynczego projektu po id lub slug.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        slug: z.string().optional(),
      }),
    },
    async ({ id, slug }) => {
      if (id) {
        const rows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
          .limit(1);
        return jsonText(rows[0] ?? null);
      }
      if (slug) {
        const rows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
          .limit(1);
        return jsonText(rows[0] ?? null);
      }
      return jsonText({ error: "Wymagane id lub slug" });
    }
  );

  server.registerTool(
    "list_segments",
    {
      description: "Listuje segmenty docelowe dla projektu.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(segments)
        .where(
          and(eq(segments.projectId, projectId), isNull(segments.deletedAt))
        );
      return jsonText(rows);
    }
  );

  server.registerTool(
    "list_kpis",
    {
      description: "Listuje KPI projektu.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)));
      return jsonText(rows);
    }
  );

  server.registerTool(
    "list_user_flows",
    {
      description: "Listuje user flows projektu.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(userFlows)
        .where(
          and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))
        );
      return jsonText(rows);
    }
  );

  server.registerTool(
    "list_pages",
    {
      description: "Listuje podstrony projektu.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)));
      return jsonText(rows);
    }
  );

  server.registerTool(
    "list_seo_keywords",
    {
      description: "Listuje frazy SEO projektu.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(seoKeywords)
        .where(
          and(
            eq(seoKeywords.projectId, projectId),
            isNull(seoKeywords.deletedAt)
          )
        );
      return jsonText(rows);
    }
  );

  server.registerTool(
    "get_business_strategy",
    {
      description:
        "Zwraca pełną strategię biznesową projektu z 5 encji relacyjnych: business_problems (goals), uvp, brand_positioning, competitors, objections. Zwraca też legacy markdown z business_strategy.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const [
        legacyRows,
        problemRows,
        uvpRows,
        positioningRows,
        competitorRows,
        objectionRows,
      ] = await Promise.all([
        db
          .select()
          .from(businessStrategy)
          .where(eq(businessStrategy.projectId, projectId))
          .limit(1),
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

      return jsonText({
        problems: problemRows,
        uvp: uvpRows[0] ?? null,
        positioning: positioningRows[0] ?? null,
        competitors: competitorRows,
        objections: objectionRows,
        legacy: legacyRows[0] ?? null,
      });
    }
  );

  server.registerTool(
    "update_business_strategy",
    {
      description:
        "Aktualizuje sekcję strategii biznesowej. section: goals | uvp | competitors | objections. Dla goals/uvp/objections: JSON tablica [{\"text\":\"…\",\"note\":\"…\",\"weight\":1|2|3}] — 1=neutralne, 2=średnie, 3=ważne.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        section: z.enum(["goals", "uvp", "competitors", "objections"]),
        content: z.string(),
      }),
    },
    async ({ projectId, section, content }) => {
      const fieldMap = {
        goals: "goalsMd",
        uvp: "uvpMd",
        competitors: "competitorsMd",
        objections: "objectionsMd",
      } as const;

      const existing = await db
        .select()
        .from(businessStrategy)
        .where(eq(businessStrategy.projectId, projectId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(businessStrategy)
          .set({ [fieldMap[section]]: content, updatedAt: new Date() })
          .where(eq(businessStrategy.projectId, projectId));
      } else {
        await db.insert(businessStrategy).values({
          projectId,
          [fieldMap[section]]: content,
        });
      }
      return jsonText({ ok: true, section });
    }
  );

  // ── Nowe encje strategii biznesowej (5 entities) ──────────────────

  server.registerTool(
    "upsert_business_problem",
    {
      description:
        "Tworzy lub aktualizuje cel/problem biznesowy. priority: 1=neutralne, 2=średnie, 3=ważne.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        problemMd: z.string().min(1),
        ambitionMd: z.string().optional().nullable(),
        ourSolutionMd: z.string().optional().nullable(),
        priority: z.number().int().min(1).max(3).optional(),
        orderIdx: z.number().int().optional(),
      }),
    },
    async ({ id, projectId, ...rest }) => {
      if (id) {
        const updated = await db
          .update(businessProblems)
          .set({ ...rest, updatedAt: new Date() })
          .where(
            and(
              eq(businessProblems.id, id),
              eq(businessProblems.projectId, projectId)
            )
          )
          .returning();
        return jsonText(updated[0] ?? { error: "not found" });
      }
      const inserted = await db
        .insert(businessProblems)
        .values({ projectId, ...rest, source: "ai" })
        .returning();
      return jsonText(inserted[0]);
    }
  );

  server.registerTool(
    "upsert_uvp",
    {
      description:
        "Aktualizuje UVP projektu (singleton). coreUvpMd to jedno zdanie, valueAddsJson to serialised JSON tablicy {text, note, weight}.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        coreUvpMd: z.string().optional().nullable(),
        valueAddsJson: z.string().optional().nullable(),
      }),
    },
    async ({ projectId, ...rest }) => {
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      const result = await db
        .insert(uvp)
        .values({ projectId, ...filtered, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: uvp.projectId,
          set: { ...filtered, updatedAt: new Date() },
        })
        .returning();
      return jsonText(result[0]);
    }
  );

  server.registerTool(
    "upsert_brand_positioning",
    {
      description:
        "Aktualizuje pozycjonowanie marki (singleton). ourX/ourY i pozycje konkurentów w zakresie -1..1.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        axisXLabel: z.string().optional().nullable(),
        axisYLabel: z.string().optional().nullable(),
        ourX: z.number().min(-1).max(1).optional().nullable(),
        ourY: z.number().min(-1).max(1).optional().nullable(),
        ourLabel: z.string().optional().nullable(),
        statementMd: z.string().optional().nullable(),
        competitorsOnQuadrant: z
          .array(
            z.object({
              id: z.string().optional(),
              label: z.string().min(1),
              x: z.number().min(-1).max(1),
              y: z.number().min(-1).max(1),
            })
          )
          .optional()
          .nullable(),
      }),
    },
    async ({ projectId, ...rest }) => {
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      const result = await db
        .insert(brandPositioning)
        .values({ projectId, ...filtered, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: brandPositioning.projectId,
          set: { ...filtered, updatedAt: new Date() },
        })
        .returning();
      return jsonText(result[0]);
    }
  );

  server.registerTool(
    "upsert_competitor",
    {
      description: "Tworzy lub aktualizuje konkurenta. type: direct|indirect|none.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        url: z.string().url().optional().nullable(),
        type: z.enum(["direct", "indirect", "none"]).optional(),
        segmentId: z.string().uuid().optional().nullable(),
        strengthsMd: z.string().optional().nullable(),
        weaknessesMd: z.string().optional().nullable(),
        pricingMd: z.string().optional().nullable(),
        channelsMd: z.string().optional().nullable(),
        notesMd: z.string().optional().nullable(),
        quadrantX: z.number().min(-1).max(1).optional().nullable(),
        quadrantY: z.number().min(-1).max(1).optional().nullable(),
      }),
    },
    async ({ id, projectId, ...rest }) => {
      if (id) {
        const updated = await db
          .update(competitors)
          .set({ ...rest, updatedAt: new Date() })
          .where(and(eq(competitors.id, id), eq(competitors.projectId, projectId)))
          .returning();
        return jsonText(updated[0] ?? { error: "not found" });
      }
      const inserted = await db
        .insert(competitors)
        .values({ projectId, ...rest, source: "ai" })
        .returning();
      return jsonText(inserted[0]);
    }
  );

  server.registerTool(
    "upsert_objection",
    {
      description:
        "Tworzy lub aktualizuje obiekcję. stage: TOFU|MOFU|BOFU|retention. status: active|resolved|needs_proof.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        objectionMd: z.string().min(1),
        responseMd: z.string().optional().nullable(),
        proofMd: z.string().optional().nullable(),
        segmentId: z.string().uuid().optional().nullable(),
        stage: z.enum(["TOFU", "MOFU", "BOFU", "retention"]).optional().nullable(),
        status: z.enum(["active", "resolved", "needs_proof"]).optional(),
        priority: z.number().int().min(1).max(3).optional(),
        orderIdx: z.number().int().optional(),
      }),
    },
    async ({ id, projectId, ...rest }) => {
      if (id) {
        const updated = await db
          .update(objections)
          .set({ ...rest, updatedAt: new Date() })
          .where(and(eq(objections.id, id), eq(objections.projectId, projectId)))
          .returning();
        return jsonText(updated[0] ?? { error: "not found" });
      }
      const inserted = await db
        .insert(objections)
        .values({ projectId, ...rest, source: "ai" })
        .returning();
      return jsonText(inserted[0]);
    }
  );

  server.registerTool(
    "upsert_segment",
    {
      description: "Tworzy lub aktualizuje segment docelowy.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        name: z.string().min(1),
        persona: z.string().optional(),
        jtbd: z.string().optional(),
        problem: z.string().optional(),
        uvpText: z.string().optional(),
        priority: z.number().int().optional(),
      }),
    },
    async ({ id, projectId, name, ...rest }) => {
      if (id) {
        await db
          .update(segments)
          .set({ name, projectId, ...rest })
          .where(eq(segments.id, id));
        return jsonText({ ok: true, id });
      }
      const inserted = await db
        .insert(segments)
        .values({ projectId, name, ...rest })
        .returning();
      return jsonText(inserted[0]);
    }
  );

  server.registerTool(
    "upsert_kpi",
    {
      description: "Tworzy lub aktualizuje KPI.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        name: z.string().min(1),
        target: z.string().optional(),
        actual: z.string().optional(),
        unit: z.string().optional(),
        category: z.string().optional(),
      }),
    },
    async ({ id, projectId, name, ...rest }) => {
      if (id) {
        await db
          .update(kpis)
          .set({ name, projectId, ...rest })
          .where(eq(kpis.id, id));
        return jsonText({ ok: true, id });
      }
      const inserted = await db
        .insert(kpis)
        .values({ projectId, name, ...rest })
        .returning();
      return jsonText(inserted[0]);
    }
  );

  return server;
}

export const MCP_TOOL_NAMES = [
  "list_projects",
  "get_project",
  "list_segments",
  "list_kpis",
  "list_user_flows",
  "list_pages",
  "list_seo_keywords",
  "get_business_strategy",
  "update_business_strategy",
  "upsert_business_problem",
  "upsert_uvp",
  "upsert_brand_positioning",
  "upsert_competitor",
  "upsert_objection",
  "upsert_segment",
  "upsert_kpi",
] as const;
