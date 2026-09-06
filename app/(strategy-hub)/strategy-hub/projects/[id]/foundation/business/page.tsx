import Link from "next/link";
import { notFound } from "next/navigation";
import { Link2 } from "lucide-react";
import { db } from "@/db";
import {
  projects,
  businessProblems,
  objections,
  uvp,
  brandPositioning,
  competitors,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";
import { BusinessStrategyEditorLoader } from "../../business/business-strategy-editor-loader";

export const metadata = { title: "Strategia biznesowa" };

interface Props {
  params: Promise<{ id: string }>;
}

async function getData(id: string) {
  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) return null;

  // Ta strona czyta bazę bezpośrednio (RSC), z pominięciem API — więc regułę
  // dziedziczenia fundamentu (W0) musi zastosować sama. Problemy, UVP,
  // pozycjonowanie i konkurenci pochodzą z projektu-źródła; obiekcje NIE są
  // encją fundamentu i zostają lokalne.
  const foundation = await resolveFoundationSource(id);
  const fundamentId = foundation.projectId;

  const [
    problemRows,
    objectionRows,
    uvpRows,
    positioningRows,
    competitorRows,
  ] = await Promise.all([
    db
      .select()
      .from(businessProblems)
      .where(
        and(
          eq(businessProblems.projectId, fundamentId),
          isNull(businessProblems.deletedAt)
        )
      )
      .orderBy(asc(businessProblems.orderIdx), asc(businessProblems.createdAt)),
    db
      .select()
      .from(objections)
      .where(and(eq(objections.projectId, id), isNull(objections.deletedAt)))
      .orderBy(asc(objections.orderIdx), asc(objections.createdAt)),
    db.select().from(uvp).where(eq(uvp.projectId, fundamentId)).limit(1),
    db
      .select()
      .from(brandPositioning)
      .where(eq(brandPositioning.projectId, fundamentId))
      .limit(1),
    db
      .select()
      .from(competitors)
      .where(
        and(eq(competitors.projectId, fundamentId), isNull(competitors.deletedAt))
      )
      .orderBy(asc(competitors.createdAt)),
  ]);

  const uvpRow = uvpRows[0] ?? {
    projectId: fundamentId,
    coreUvpMd: null,
    valueAddsJson: null,
  };

  const positioningRow = positioningRows[0] ?? {
    projectId: fundamentId,
    axisXLabel: null,
    axisYLabel: null,
    ourX: null,
    ourY: null,
    ourLabel: null,
    competitorsOnQuadrant: null,
    statementMd: null,
    nicheMd: null,
    antiIcpMd: null,
  };

  return {
    project,
    foundation,
    problems: problemRows,
    objections: objectionRows,
    uvp: uvpRow,
    positioning: positioningRow,
    competitors: competitorRows,
  };
}

export default async function BusinessStrategyPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getData(id);
  } catch {
    data = null;
  }

  if (!data) notFound();

  return (
    <>
      {data.foundation.inherited && (
        // Pasek informacyjny, nie blokada: dane widać i można je czytać,
        // ale zapis wróci z 409 (FOUNDATION_INHERITED) z API. Ujemne marginesy
        // znoszą padding `main`, a `mb-6` kasuje się z `-m-6` edytora
        // (kolapsowanie marginesów), więc edytor zaczyna się tuż pod paskiem.
        <div className="-mx-6 -mt-6 mb-6 flex items-start gap-2 border-b border-brand/25 bg-brand/5 px-4 py-2 text-xs text-muted-foreground">
          <Link2 className="mt-0.5 size-3.5 shrink-0 text-brand/80" />
          <p>
            Fundament strategii jest dziedziczony z projektu{" "}
            <span className="font-medium text-foreground">
              {data.foundation.sourceName ?? "nadrzędnego"}
            </span>
            . Zmiany zapisuj w projekcie źródłowym albo odłącz dziedziczenie
            (tryb strategii &bdquo;własna&rdquo;) w{" "}
            <Link
              href={`/strategy-hub/projects/${id}/project-settings/general`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Ustawieniach projektu → Ogólne
            </Link>
            .
          </p>
        </div>
      )}
      <BusinessStrategyEditorLoader
        projectId={id}
        projectName={data.project.name}
        problems={data.problems}
        objections={data.objections}
        uvp={data.uvp}
        positioning={data.positioning}
        competitors={data.competitors}
      />
    </>
  );
}
