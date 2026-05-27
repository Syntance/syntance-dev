import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/db";
import {
  projects,
  segments,
  kpis,
  userFlows,
  businessStrategy,
  pages,
  seoKeywords,
} from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

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
        "Zwraca strategię biznesową projektu (markdown: goals, uvp, competitors, objections).",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      const rows = await db
        .select()
        .from(businessStrategy)
        .where(eq(businessStrategy.projectId, projectId))
        .limit(1);
      return jsonText(rows[0] ?? null);
    }
  );

  server.registerTool(
    "update_business_strategy",
    {
      description:
        "Aktualizuje sekcję strategii biznesowej. section: goals | uvp | competitors | objections.",
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
  "upsert_segment",
  "upsert_kpi",
] as const;
