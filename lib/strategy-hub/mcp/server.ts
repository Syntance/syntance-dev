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
  channels,
  funnelElements,
  funnelElementChannels,
  buyerJourneyStages,
  aiProposals,
} from "@/db/schema";
import { eq, isNull, and, asc, desc, inArray } from "drizzle-orm";
import { EVENT_REGISTRY } from "@/packages/analytics-events/src";
import { AGENT_MODES, runAgentMode } from "@/lib/strategy-hub/agent/run-agent";
import { acceptProposal, rejectProposal } from "@/lib/strategy-hub/agent/accept-proposal";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { getProjectAlerts } from "@/lib/strategy-hub/alerts";
import {
  getListEntity,
  getSingletonEntity,
  getSegmentChild,
  getPageChild,
  getAuditChild,
  getKpiChild,
  listEntityKeys,
  singletonEntityKeys,
  segmentChildKeys,
  pageChildKeys,
  auditChildKeys,
  kpiChildKeys,
} from "@/lib/strategy-hub/entities/registry";

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Bezpieczne wykonanie z czytelnym błędem walidacji Zod dla agenta AI. */
async function safeRun<T>(fn: () => Promise<T>) {
  try {
    return jsonText(await fn());
  } catch (e) {
    const err = e as { message?: string; issues?: unknown };
    return jsonText({
      error: err.message ?? "Operation failed",
      issues: err.issues,
    });
  }
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

  // ── Generyczne narzędzia hub_ (pełne CRUD dla wszystkich nowych encji) ──────
  //
  // Zamiast dziesiątek niemal identycznych narzędzi, agent AI używa rejestru
  // encji: hub_catalog ujawnia dostępne klucze, a hub_* operuje po kluczu.
  // Dane przechodzą walidację Zod ze schematów rejestru (create/patch).

  const dataSchema = z.record(z.string(), z.unknown());

  server.registerTool(
    "hub_catalog",
    {
      description:
        "Zwraca katalog dostępnych encji Strategy Hub: listy, singletony oraz dzieci (segment/page/audit/kpi). Użyj, by poznać klucze do pozostałych narzędzi hub_*.",
      inputSchema: z.object({}),
    },
    async () =>
      jsonText({
        list: listEntityKeys(),
        singleton: singletonEntityKeys(),
        segmentChildren: segmentChildKeys(),
        pageChildren: pageChildKeys(),
        auditChildren: auditChildKeys(),
        kpiChildren: kpiChildKeys(),
      })
  );

  // — Encje listowe (project-scoped) —
  server.registerTool(
    "hub_list",
    {
      description:
        "Listuje rekordy encji projektowej. entity: klucz z hub_catalog.list (np. questions, glossary, sales-pitches, nav-items, kpis).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
      }),
    },
    async ({ projectId, entity }) =>
      safeRun(async () => {
        const def = getListEntity(entity);
        if (!def) throw new Error(`Unknown list entity: ${entity}`);
        return def.list(projectId);
      })
  );

  server.registerTool(
    "hub_create",
    {
      description:
        "Tworzy rekord encji projektowej. data walidowane wg schematu encji. entity: klucz z hub_catalog.list.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
        data: dataSchema,
      }),
    },
    async ({ projectId, entity, data }) =>
      safeRun(async () => {
        const def = getListEntity(entity);
        if (!def) throw new Error(`Unknown list entity: ${entity}`);
        return def.create(projectId, def.createSchema.parse(data));
      })
  );

  server.registerTool(
    "hub_update",
    {
      description: "Aktualizuje rekord encji projektowej (PATCH częściowy).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
        itemId: z.string().uuid(),
        data: dataSchema,
      }),
    },
    async ({ projectId, entity, itemId, data }) =>
      safeRun(async () => {
        const def = getListEntity(entity);
        if (!def) throw new Error(`Unknown list entity: ${entity}`);
        return (
          (await def.update(projectId, itemId, def.patchSchema.parse(data))) ?? {
            error: "not found",
          }
        );
      })
  );

  server.registerTool(
    "hub_delete",
    {
      description: "Usuwa (soft delete) rekord encji projektowej.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
        itemId: z.string().uuid(),
      }),
    },
    async ({ projectId, entity, itemId }) =>
      safeRun(async () => {
        const def = getListEntity(entity);
        if (!def) throw new Error(`Unknown list entity: ${entity}`);
        return { ok: await def.softDelete(projectId, itemId) };
      })
  );

  // — Singletony (project-scoped) —
  server.registerTool(
    "hub_get_singleton",
    {
      description:
        "Zwraca singleton projektu. entity: klucz z hub_catalog.singleton (np. brand-identity, brand-visual, copy-guidelines, market-segmentation).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
      }),
    },
    async ({ projectId, entity }) =>
      safeRun(async () => {
        const def = getSingletonEntity(entity);
        if (!def) throw new Error(`Unknown singleton: ${entity}`);
        return (await def.get(projectId)) ?? null;
      })
  );

  server.registerTool(
    "hub_upsert_singleton",
    {
      description: "Tworzy/aktualizuje singleton projektu (upsert).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entity: z.string(),
        data: dataSchema,
      }),
    },
    async ({ projectId, entity, data }) =>
      safeRun(async () => {
        const def = getSingletonEntity(entity);
        if (!def) throw new Error(`Unknown singleton: ${entity}`);
        return def.upsert(projectId, def.patchSchema.parse(data));
      })
  );

  // — Dzieci scoped (segment/page/audit/kpi) —
  const childGetter = {
    segment: getSegmentChild,
    page: getPageChild,
    audit: getAuditChild,
    kpi: getKpiChild,
  } as const;

  server.registerTool(
    "hub_list_children",
    {
      description:
        "Listuje dzieci encji nadrzędnej. scope: segment|page|audit|kpi. child: klucz z odpowiedniego katalogu (np. buyer-journey, sections, findings, snapshots). parentId: id encji nadrzędnej.",
      inputSchema: z.object({
        scope: z.enum(["segment", "page", "audit", "kpi"]),
        child: z.string(),
        parentId: z.string().uuid(),
      }),
    },
    async ({ scope, child, parentId }) =>
      safeRun(async () => {
        const def = childGetter[scope](child);
        if (!def) throw new Error(`Unknown ${scope} child: ${child}`);
        return def.list(parentId);
      })
  );

  server.registerTool(
    "hub_create_child",
    {
      description:
        "Tworzy dziecko encji nadrzędnej (scope: segment|page|audit|kpi).",
      inputSchema: z.object({
        scope: z.enum(["segment", "page", "audit", "kpi"]),
        child: z.string(),
        parentId: z.string().uuid(),
        data: dataSchema,
      }),
    },
    async ({ scope, child, parentId, data }) =>
      safeRun(async () => {
        const def = childGetter[scope](child);
        if (!def) throw new Error(`Unknown ${scope} child: ${child}`);
        return def.create(parentId, def.createSchema.parse(data));
      })
  );

  server.registerTool(
    "hub_update_child",
    {
      description: "Aktualizuje dziecko encji nadrzędnej (PATCH częściowy).",
      inputSchema: z.object({
        scope: z.enum(["segment", "page", "audit", "kpi"]),
        child: z.string(),
        parentId: z.string().uuid(),
        itemId: z.string().uuid(),
        data: dataSchema,
      }),
    },
    async ({ scope, child, parentId, itemId, data }) =>
      safeRun(async () => {
        const def = childGetter[scope](child);
        if (!def) throw new Error(`Unknown ${scope} child: ${child}`);
        return (
          (await def.update(parentId, itemId, def.patchSchema.parse(data))) ?? {
            error: "not found",
          }
        );
      })
  );

  server.registerTool(
    "hub_delete_child",
    {
      description: "Usuwa (soft delete) dziecko encji nadrzędnej.",
      inputSchema: z.object({
        scope: z.enum(["segment", "page", "audit", "kpi"]),
        child: z.string(),
        parentId: z.string().uuid(),
        itemId: z.string().uuid(),
      }),
    },
    async ({ scope, child, parentId, itemId }) =>
      safeRun(async () => {
        const def = childGetter[scope](child);
        if (!def) throw new Error(`Unknown ${scope} child: ${child}`);
        return { ok: await def.softDelete(parentId, itemId) };
      })
  );

  // ── Narzędzia relacyjne (Faza 12, M3) ───────────────────────────────────────

  server.registerTool(
    "hub_list_analytics_events",
    {
      description:
        "Zwraca pełny słownik zdarzeń analitycznych (@syntance/analytics-events) — klucze do przypisania w kpis.event_key i funnel_element_events.",
      inputSchema: z.object({}),
    },
    async () => jsonText(EVENT_REGISTRY)
  );

  server.registerTool(
    "hub_link_element_to_channel",
    {
      description:
        "Dowiązuje kanał do elementu lejka (append, idempotentne — nie usuwa istniejących powiązań, w przeciwieństwie do PUT /relations w UI).",
      inputSchema: z.object({
        funnelElementId: z.string().uuid(),
        channelId: z.string().uuid(),
      }),
    },
    async ({ funnelElementId, channelId }) =>
      safeRun(async () => {
        const existing = await db
          .select()
          .from(funnelElementChannels)
          .where(
            and(
              eq(funnelElementChannels.funnelElementId, funnelElementId),
              eq(funnelElementChannels.channelId, channelId)
            )
          )
          .limit(1);
        if (existing.length === 0) {
          await db.insert(funnelElementChannels).values({ funnelElementId, channelId });
        }
        return { ok: true };
      })
  );

  server.registerTool(
    "hub_promote_to_funnel",
    {
      description:
        "Przekuwa etap mapy myśli klienta (buyer journey stage) na nowy element lejka we wskazanym etapie zakupu (purchase stage). Odpowiednik akcji „Przekuj na lejek” w UI.",
      inputSchema: z.object({
        buyerJourneyStageId: z.string().uuid(),
        targetPurchaseStageId: z.string().uuid(),
      }),
    },
    async ({ buyerJourneyStageId, targetPurchaseStageId }) =>
      safeRun(async () => {
        const [stage] = await db
          .select()
          .from(buyerJourneyStages)
          .where(eq(buyerJourneyStages.id, buyerJourneyStageId))
          .limit(1);
        if (!stage) throw new Error("Buyer journey stage not found");
        const inserted = await db
          .insert(funnelElements)
          .values({
            stageId: targetPurchaseStageId,
            segmentId: stage.segmentId,
            name: stage.name,
            contentMd: stage.ourActionMd,
            position: 0,
          })
          .returning();
        return inserted[0];
      })
  );

  // ── Narzędzia AI-workflow (Faza 12, M3) — spinają się z Agentem AI (Faza 10) ─

  server.registerTool(
    "hub_suggest_relations",
    {
      description:
        "Sugeruje relacje do ręcznego dowiązania (NIE zapisuje niczego — czysta podpowiedź). entityType: funnel_element (sugeruje kanały używane przez sąsiednie elementy tego samego etapu, jeszcze niepowiązane) | segment (sugeruje KPI projektu bez przypisanego segmentu).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        entityType: z.enum(["funnel_element", "segment"]),
        entityId: z.string().uuid(),
      }),
    },
    async ({ projectId, entityType, entityId }) =>
      safeRun(async () => {
        if (entityType === "funnel_element") {
          const [element] = await db
            .select()
            .from(funnelElements)
            .where(eq(funnelElements.id, entityId))
            .limit(1);
          if (!element) throw new Error("Funnel element not found");

          const linked = await db
            .select({ channelId: funnelElementChannels.channelId })
            .from(funnelElementChannels)
            .where(eq(funnelElementChannels.funnelElementId, entityId));
          const linkedIds = new Set(linked.map((l) => l.channelId));

          const siblings = await db
            .select({ id: funnelElements.id })
            .from(funnelElements)
            .where(
              and(
                eq(funnelElements.stageId, element.stageId),
                isNull(funnelElements.deletedAt)
              )
            );
          const siblingIds = siblings.map((s) => s.id).filter((id) => id !== entityId);
          if (siblingIds.length === 0) return { suggestions: [] };

          const usedChannels = await db
            .select({ channelId: funnelElementChannels.channelId })
            .from(funnelElementChannels)
            .where(inArray(funnelElementChannels.funnelElementId, siblingIds));
          const candidateIds = Array.from(
            new Set(usedChannels.map((u) => u.channelId).filter((id) => !linkedIds.has(id)))
          );
          if (candidateIds.length === 0) return { suggestions: [] };

          const rows = await db
            .select({ id: channels.id, name: channels.name })
            .from(channels)
            .where(inArray(channels.id, candidateIds));
          return {
            suggestions: rows.map((r) => ({
              type: "channel",
              id: r.id,
              label: r.name,
              reason: "Używany przez inne elementy tego samego etapu lejka",
            })),
          };
        }

        const rows = await db
          .select({ id: kpis.id, name: kpis.name })
          .from(kpis)
          .where(
            and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt), isNull(kpis.segmentId))
          )
          .limit(10);
        return {
          suggestions: rows.map((r) => ({
            type: "kpi",
            id: r.id,
            label: r.name,
            reason: "KPI projektu bez przypisanego segmentu",
          })),
        };
      })
  );

  server.registerTool(
    "run_agent_mode",
    {
      description:
        "Uruchamia jeden z 4 trybów Agenta AI (audit|research|improve|monitor). Tworzy propozycje w kolejce ai_proposals — TWARDA zasada zero-direct-write: to narzędzie NIGDY nie zapisuje bezpośrednio do encji strategicznych.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        mode: z.enum(AGENT_MODES),
      }),
    },
    async ({ projectId, mode }) => safeRun(() => runAgentMode(projectId, mode))
  );

  server.registerTool(
    "list_ai_proposals",
    {
      description:
        "Listuje propozycje agenta AI z kolejki ai_proposals, opcjonalnie filtrowane po statusie.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        status: z.enum(["pending", "accepted", "rejected", "expired"]).optional(),
      }),
    },
    async ({ projectId, status }) =>
      safeRun(async () =>
        db
          .select()
          .from(aiProposals)
          .where(
            status
              ? and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, status))
              : eq(aiProposals.projectId, projectId)
          )
          .orderBy(desc(aiProposals.createdAt))
          .limit(100)
      )
  );

  server.registerTool(
    "accept_ai_proposal",
    {
      description:
        "Akceptuje propozycję agenta AI — jedyna droga, którą zmiana wygenerowana przez AI trafia do encji strategicznej (source='ai' + wpis w change_history).",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        proposalId: z.string().uuid(),
      }),
    },
    async ({ projectId, proposalId }) => safeRun(() => acceptProposal(projectId, proposalId))
  );

  server.registerTool(
    "reject_ai_proposal",
    {
      description: "Odrzuca propozycję agenta AI bez żadnego zapisu do encji strategicznej.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        proposalId: z.string().uuid(),
      }),
    },
    async ({ projectId, proposalId }) => safeRun(() => rejectProposal(projectId, proposalId))
  );

  server.registerTool(
    "get_project_health",
    {
      description:
        "Zwraca health-score projektu (0-100 ogólny + per moduł: discovery/brand/business/segments/funnel/sales/website/kpi) wg silnika reguł.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => safeRun(() => computeProjectHealth(projectId))
  );

  server.registerTool(
    "get_project_alerts",
    {
      description:
        "Zwraca aktywne alerty projektu: KPI poniżej progu, domena wygasająca, brak wizyt klienta.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => safeRun(() => getProjectAlerts(projectId))
  );

  return server;
}

export const MCP_TOOL_NAMES = [
  "hub_catalog",
  "hub_list",
  "hub_create",
  "hub_update",
  "hub_delete",
  "hub_get_singleton",
  "hub_upsert_singleton",
  "hub_list_children",
  "hub_create_child",
  "hub_update_child",
  "hub_delete_child",
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
  "hub_list_analytics_events",
  "hub_link_element_to_channel",
  "hub_promote_to_funnel",
  "hub_suggest_relations",
  "run_agent_mode",
  "list_ai_proposals",
  "accept_ai_proposal",
  "reject_ai_proposal",
  "get_project_health",
  "get_project_alerts",
] as const;
