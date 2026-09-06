import Link from "next/link";
import { PositioningMini } from "@/components/strategy-hub/positioning-mini";
import { CompetitorDatabase } from "@/components/strategy-hub/competitor-database";
import type { CompetitionAnalysis } from "@/lib/strategy-hub/competition-analysis";
import {
  AnalysisField,
  AnalysisProse,
  AnalysisSection,
  AnalysisStat,
} from "@/components/strategy-hub/analysis-primitives";

/**
 * Widok „Analiza konkurencji" — konfigurator, nie raport. Baza konkurentów
 * (tabela z kolumnami-kategoriami, klik w wiersz otwiera kartę) jest głównym
 * elementem strony i sama zarządza swoimi danymi; pozycjonowanie i obiekcje
 * zostają czytelniczymi sekcjami obok, bo edytuje się je gdzie indziej.
 */
export function CompetitionAnalysisView({
  data,
  projectId,
}: {
  data: CompetitionAnalysis;
  projectId: string;
}) {
  // Ustalone przez resolvera: sourceName jest niepuste wtedy i tylko wtedy,
  // gdy fundament jest dziedziczony (patrz resolveFoundationSource).
  const foundationInherited = data.foundationSourceName !== null;

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalysisStat label="Konkurenci" value={data.competitorCount} />
        <AnalysisStat
          label="Typy konkurencji"
          value={data.byType.length}
          hint={data.byType.map((g) => g.type).join(" · ") || undefined}
        />
        <AnalysisStat
          label="Bez mocnych i słabych stron"
          value={data.withoutSwot}
          hint={
            data.withoutSwot > 0 ? "profile do uzupełnienia" : "wszystkie opisane"
          }
          alarm={data.withoutSwot > 0}
        />
        <AnalysisStat
          label="Obiekcje"
          value={data.objections.length}
          hint="zebrane od rynku"
        />
      </section>

      <AnalysisSection
        title="Baza konkurentów"
        hint="Kliknij konkurenta, żeby otworzyć jego pełną kartę. Werdykt cenowy klika się wprost w tabeli."
      >
        <CompetitorDatabase
          projectId={projectId}
          foundationInherited={foundationInherited}
          foundationSourceName={data.foundationSourceName}
        />
      </AnalysisSection>

      {data.positioning && (
        <AnalysisSection
          title="Pozycjonowanie"
          hint="Gdzie stoimy względem konkurencji na dwóch osiach, które sami wybraliśmy."
          action={
            <Link
              href={`/strategy-hub/projects/${projectId}/foundation/business`}
              className="shrink-0 text-xs text-brand underline underline-offset-2"
            >
              Edytuj pozycjonowanie
            </Link>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className="flex justify-center rounded-xl border border-border bg-card p-4">
              <PositioningMini
                variant="full"
                ourX={data.positioning.ourX}
                ourY={data.positioning.ourY}
                ourLabel={data.positioning.ourLabel}
                competitors={data.positioning.markers}
                axisXLabel={data.positioning.axisXLabel}
                axisYLabel={data.positioning.axisYLabel}
              />
            </div>
            <div className="space-y-5">
              <AnalysisField
                label="Zdanie pozycjonujące"
                value={data.positioning.statementMd}
              />
              <AnalysisField label="Nisza" value={data.positioning.nicheMd} />
              <AnalysisField
                label="Dla kogo NIE jesteśmy"
                value={data.positioning.antiIcpMd}
              />
            </div>
          </div>
        </AnalysisSection>
      )}

      {data.objections.length > 0 && (
        <AnalysisSection
          title="Obiekcje rynku"
          hint="Co słyszymy od klientów i czym na to odpowiadamy — pierwsza linia styku z konkurencją."
          action={
            <Link
              href={`/strategy-hub/projects/${projectId}/foundation/business`}
              className="shrink-0 text-xs text-brand underline underline-offset-2"
            >
              Edytuj obiekcje
            </Link>
          }
        >
          <div className="space-y-3">
            {data.objections.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <AnalysisProse className="text-sm font-medium">
                    {o.objectionMd}
                  </AnalysisProse>
                  {o.segmentName && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {o.segmentName}
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AnalysisField label="Odpowiedź" value={o.responseMd} />
                  <AnalysisField label="Dowód" value={o.proofMd} />
                </div>
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}
    </div>
  );
}
