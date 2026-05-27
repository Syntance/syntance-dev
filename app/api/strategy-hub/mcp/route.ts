import { NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";

/**
 * MCP-over-HTTP endpoint dla Strategy Hub.
 * Implementuje JSON-RPC 2.0 + podstawowe metody MCP: initialize, tools/list, tools/call.
 *
 * Autoryzacja: nagłówek `Authorization: Bearer <MCP_TOKEN>`.
 *
 * Read tools: get_project, list_segments, list_kpis, list_user_flows,
 *             list_pages, list_seo_keywords, get_business_strategy
 * Write tools: update_business_strategy, upsert_segment, upsert_kpi
 */

const TOOLS = [
  {
    name: "list_projects",
    description:
      "Zwraca wszystkie aktywne projekty z bazy Strategy Hub.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_project",
    description: "Zwraca dane pojedynczego projektu po id lub slug.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        slug: { type: "string" },
      },
    },
  },
  {
    name: "list_segments",
    description: "Listuje segmenty docelowe dla projektu.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "list_kpis",
    description: "Listuje KPI projektu.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "list_user_flows",
    description: "Listuje user flows projektu.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "list_pages",
    description: "Listuje podstrony projektu.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "list_seo_keywords",
    description: "Listuje frazy SEO projektu.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_business_strategy",
    description:
      "Zwraca strategię biznesową projektu (markdown: goals, uvp, competitors, objections).",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "update_business_strategy",
    description:
      "Aktualizuje sekcję strategii biznesowej. Pole `section` jedno z: goals, uvp, competitors, objections.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        section: {
          type: "string",
          enum: ["goals", "uvp", "competitors", "objections"],
        },
        content: { type: "string" },
      },
      required: ["projectId", "section", "content"],
    },
  },
  {
    name: "upsert_segment",
    description: "Tworzy lub aktualizuje segment docelowy.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        projectId: { type: "string" },
        name: { type: "string" },
        persona: { type: "string" },
        jtbd: { type: "string" },
        problem: { type: "string" },
        uvpText: { type: "string" },
        priority: { type: "number" },
      },
      required: ["projectId", "name"],
    },
  },
  {
    name: "upsert_kpi",
    description: "Tworzy lub aktualizuje KPI.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        projectId: { type: "string" },
        name: { type: "string" },
        target: { type: "string" },
        actual: { type: "string" },
        unit: { type: "string" },
        category: { type: "string" },
      },
      required: ["projectId", "name"],
    },
  },
];

function jsonRpc(
  id: number | string | null,
  result?: unknown,
  error?: { code: number; message: string }
) {
  if (error) return { jsonrpc: "2.0", id, error };
  return { jsonrpc: "2.0", id, result };
}

function authorized(req: NextRequest): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return true; // dev mode — bez tokenu
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_projects": {
      return await db
        .select()
        .from(projects)
        .where(isNull(projects.deletedAt));
    }
    case "get_project": {
      const { id, slug } = args as { id?: string; slug?: string };
      if (id) {
        const rows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      }
      if (slug) {
        const rows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      }
      throw new Error("Wymagane id lub slug");
    }
    case "list_segments": {
      const { projectId } = args as { projectId: string };
      return await db
        .select()
        .from(segments)
        .where(
          and(eq(segments.projectId, projectId), isNull(segments.deletedAt))
        );
    }
    case "list_kpis": {
      const { projectId } = args as { projectId: string };
      return await db
        .select()
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)));
    }
    case "list_user_flows": {
      const { projectId } = args as { projectId: string };
      return await db
        .select()
        .from(userFlows)
        .where(
          and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))
        );
    }
    case "list_pages": {
      const { projectId } = args as { projectId: string };
      return await db
        .select()
        .from(pages)
        .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)));
    }
    case "list_seo_keywords": {
      const { projectId } = args as { projectId: string };
      return await db
        .select()
        .from(seoKeywords)
        .where(
          and(
            eq(seoKeywords.projectId, projectId),
            isNull(seoKeywords.deletedAt)
          )
        );
    }
    case "get_business_strategy": {
      const { projectId } = args as { projectId: string };
      const rows = await db
        .select()
        .from(businessStrategy)
        .where(eq(businessStrategy.projectId, projectId))
        .limit(1);
      return rows[0] ?? null;
    }
    case "update_business_strategy": {
      const { projectId, section, content } = args as {
        projectId: string;
        section: "goals" | "uvp" | "competitors" | "objections";
        content: string;
      };
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
      return { ok: true, section };
    }
    case "upsert_segment": {
      const { id, projectId, name: segName, ...rest } = args as Record<
        string,
        string | number
      > & { id?: string; projectId: string; name: string };
      if (id) {
        await db
          .update(segments)
          .set({ name: segName, projectId, ...rest })
          .where(eq(segments.id, id));
        return { ok: true, id };
      } else {
        const inserted = await db
          .insert(segments)
          .values({ projectId, name: segName, ...rest })
          .returning();
        return inserted[0];
      }
    }
    case "upsert_kpi": {
      const { id, projectId, name: kName, ...rest } = args as Record<
        string,
        string | number
      > & { id?: string; projectId: string; name: string };
      if (id) {
        await db
          .update(kpis)
          .set({ name: kName, projectId, ...rest })
          .where(eq(kpis.id, id));
        return { ok: true, id };
      } else {
        const inserted = await db
          .insert(kpis)
          .values({ projectId, name: kName, ...rest })
          .returning();
        return inserted[0];
      }
    }
    default:
      throw new Error(`Nieznane narzędzie: ${name}`);
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      jsonRpc(null, undefined, { code: -32001, message: "Unauthorized" }),
      { status: 401 }
    );
  }

  let body: {
    jsonrpc?: string;
    id?: number | string | null;
    method?: string;
    params?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      jsonRpc(null, undefined, { code: -32700, message: "Parse error" }),
      { status: 400 }
    );
  }

  const { id = null, method, params = {} } = body;

  try {
    switch (method) {
      case "initialize":
        return NextResponse.json(
          jsonRpc(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "syntance-strategy-hub",
              version: "0.1.0",
            },
          })
        );

      case "tools/list":
        return NextResponse.json(jsonRpc(id, { tools: TOOLS }));

      case "tools/call": {
        const { name, arguments: args = {} } = params as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        const result = await callTool(name, args);
        return NextResponse.json(
          jsonRpc(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          })
        );
      }

      case "ping":
        return NextResponse.json(jsonRpc(id, {}));

      default:
        return NextResponse.json(
          jsonRpc(id, undefined, {
            code: -32601,
            message: `Method not found: ${method}`,
          }),
          { status: 404 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      jsonRpc(id, undefined, { code: -32603, message }),
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "syntance-strategy-hub-mcp",
    version: "0.1.0",
    transport: "http-jsonrpc",
    endpoint: "/api/strategy-hub/mcp",
    method: "POST",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
