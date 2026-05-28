import { db } from "@/db";
import {
  businessStrategy,
  brandIdentity,
  brandVisual,
  segments,
  channels,
  salesPitches,
  salesScripts,
  pages,
  kpis,
  projectQuestions,
  projectMaterials,
} from "@/db/schema";
import { eq, isNull, and, count } from "drizzle-orm";

export interface ModuleHealth {
  key: string;
  label: string;
  /** 0-100 */
  score: number;
  /** Krótki opis stanu dla użytkownika. */
  hint: string;
  href: string;
}

export interface ProjectHealth {
  /** 0-100 ważona średnia modułów. */
  score: number;
  modules: ModuleHealth[];
}

function pct(filled: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((filled / total) * 100);
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Liczy „health score" projektu — kompletność danych w każdym module.
 * Każdy moduł ma własną heurystykę (singleton fields vs liczba wierszy),
 * a wynik ogólny to ważona średnia.
 */
export async function computeProjectHealth(
  projectId: string
): Promise<ProjectHealth> {
  const base = `/strategy-hub/projects/${projectId}`;

  const [
    strategy,
    identity,
    visual,
    [segCount],
    [chCount],
    [pitchCount],
    [scriptCount],
    [pageCount],
    [kpiCount],
    [qCount],
    [matCount],
  ] = await Promise.all([
    db
      .select()
      .from(businessStrategy)
      .where(eq(businessStrategy.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(brandIdentity)
      .where(eq(brandIdentity.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(brandVisual)
      .where(eq(brandVisual.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ count: count() })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({ count: count() })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({ count: count() })
      .from(salesPitches)
      .where(
        and(eq(salesPitches.projectId, projectId), isNull(salesPitches.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(salesScripts)
      .where(
        and(eq(salesScripts.projectId, projectId), isNull(salesScripts.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
    db
      .select({ count: count() })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ count: count() })
      .from(projectQuestions)
      .where(
        and(
          eq(projectQuestions.projectId, projectId),
          isNull(projectQuestions.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(projectMaterials)
      .where(
        and(
          eq(projectMaterials.projectId, projectId),
          isNull(projectMaterials.deletedAt)
        )
      ),
  ]);

  const segN = segCount?.count ?? 0;
  const chN = chCount?.count ?? 0;
  const pitchN = pitchCount?.count ?? 0;
  const scriptN = scriptCount?.count ?? 0;
  const pageN = pageCount?.count ?? 0;
  const kpiN = kpiCount?.count ?? 0;
  const qN = qCount?.count ?? 0;
  const matN = matCount?.count ?? 0;

  // Discovery — pytania + materiały (cele orientacyjne: 5 pytań, 2 materiały)
  const discoveryScore = pct(
    [qN >= 5 ? 1 : qN / 5, matN >= 2 ? 1 : matN / 2].reduce((a, b) => a + b, 0),
    2
  );

  // Marka — kluczowe pola tożsamości + paleta wizualna
  const brandChecks = [
    nonEmpty(identity?.missionMd),
    nonEmpty(identity?.visionMd),
    nonEmpty(identity?.toneOfVoiceMd ?? null),
    Boolean(visual),
  ];
  const brandScore = pct(brandChecks.filter(Boolean).length, brandChecks.length);

  // Biznes — najważniejsze sekcje markdown
  const bizChecks = [
    nonEmpty(strategy?.goalsMd),
    nonEmpty(strategy?.uvpMd),
    nonEmpty(strategy?.competitorsMd ?? null),
    nonEmpty(strategy?.objectionsMd ?? null),
  ];
  const bizScore = pct(bizChecks.filter(Boolean).length, bizChecks.length);

  const modules: ModuleHealth[] = [
    {
      key: "discovery",
      label: "Discovery",
      score: discoveryScore,
      hint: `${qN} pytań · ${matN} materiałów`,
      href: `${base}/discovery`,
    },
    {
      key: "brand",
      label: "Marka",
      score: brandScore,
      hint: brandScore >= 100 ? "Kompletna" : "Uzupełnij tożsamość",
      href: `${base}/brand`,
    },
    {
      key: "business",
      label: "Strategia biznesowa",
      score: bizScore,
      hint: bizScore >= 100 ? "Gotowa" : "Uzupełnij sekcje",
      href: `${base}/business`,
    },
    {
      key: "segments",
      label: "Segmenty",
      score: segN === 0 ? 0 : segN >= 3 ? 100 : pct(segN, 3),
      hint: `${segN} grup docelowych`,
      href: `${base}/segments`,
    },
    {
      key: "funnel",
      label: "Lejek i kanały",
      score: chN === 0 ? 0 : chN >= 4 ? 100 : pct(chN, 4),
      hint: `${chN} kanałów`,
      href: `${base}/funnel`,
    },
    {
      key: "sales",
      label: "Sprzedaż i copy",
      score: pct(
        [pitchN > 0 ? 1 : 0, scriptN > 0 ? 1 : 0].reduce((a, b) => a + b, 0),
        2
      ),
      hint: `${pitchN} pitchów · ${scriptN} skryptów`,
      href: `${base}/sales`,
    },
    {
      key: "website",
      label: "Strona",
      score: pageN === 0 ? 0 : pageN >= 4 ? 100 : pct(pageN, 4),
      hint: `${pageN} podstron`,
      href: `${base}/website`,
    },
    {
      key: "kpi",
      label: "KPI",
      score: kpiN === 0 ? 0 : kpiN >= 4 ? 100 : pct(kpiN, 4),
      hint: `${kpiN} wskaźników`,
      href: `${base}/kpi`,
    },
  ];

  const overall = Math.round(
    modules.reduce((acc, m) => acc + m.score, 0) / modules.length
  );

  return { score: overall, modules };
}
