import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PositioningMini } from "@/components/strategy-hub/positioning-mini";
import type {
  CompetitionAnalysis,
  CompetitorAnalysis,
} from "@/lib/strategy-hub/competition-analysis";
import {
  AnalysisField,
  AnalysisProse,
  AnalysisSection,
  AnalysisStat,
  EmptyAnalysis,
  GapList,
} from "@/components/strategy-hub/analysis-primitives";

/**
 * Widok „Analiza konkurencji" — trzy poziomy odczytu, od ogółu do szczegółu:
 * kwadrant pozycjonowania (gdzie jesteśmy względem innych), karty konkurentów
 * (mocne i słabe strony zestawione obok siebie), macierz porównawcza
 * (jedno spojrzenie na wszystkich naraz).
 */
export function CompetitionAnalysisView({
  data,
  projectId,
}: {
  data: CompetitionAnalysis;
  projectId: string;
}) {
  const brakDanych = data.competitorCount === 0 && !data.positioning;

  if (brakDanych) {
    return (
      <EmptyAnalysis
        title="Brak danych o konkurencji"
        description="Ten widok czyta konkurentów i pozycjonowanie z fundamentu strategii. Dodaj pierwszego konkurenta, a pojawi się tu jego profil, mocne i słabe strony oraz miejsce na kwadrancie."
        href={`/strategy-hub/projects/${projectId}/foundation/business`}
        linkLabel="Przejdź do fundamentu"
      />
    );
  }

  return (
    <div className="space-y-10">
      {data.foundationSourceName && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Konkurencja i pozycjonowanie pochodzą z projektu{" "}
          <strong>{data.foundationSourceName}</strong> — ten projekt dziedziczy
          fundament strategii.
        </p>
      )}

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

      {data.competitors.length > 0 && (
        <>
          <AnalysisSection
            title="Profile konkurentów"
            hint="Mocne i słabe strony zestawione obok siebie — tak widać, gdzie realnie jest przewaga."
            action={
              <Link
                href={`/strategy-hub/projects/${projectId}/foundation/business`}
                className="shrink-0 text-xs text-brand underline underline-offset-2"
              >
                Edytuj konkurentów
              </Link>
            }
          >
            <div className="space-y-4">
              {data.byType.map((grupa) => (
                <div key={grupa.type} className="space-y-3">
                  {data.byType.length > 1 && (
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {grupa.type}
                      <span className="ml-1.5 font-normal normal-case">
                        ({grupa.competitors.length})
                      </span>
                    </h3>
                  )}
                  {grupa.competitors.map((c) => (
                    <CompetitorCard key={c.id} competitor={c} />
                  ))}
                </div>
              ))}
            </div>
          </AnalysisSection>

          <AnalysisSection
            title="Macierz porównawcza"
            hint="Wszyscy konkurenci naraz — do wyłapania wzorców, których nie widać w pojedynczych profilach."
          >
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[52rem] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-3 text-left font-medium">Konkurent</th>
                    <th className="p-3 text-left font-medium">Mocne strony</th>
                    <th className="p-3 text-left font-medium">Słabe strony</th>
                    <th className="p-3 text-left font-medium">Cennik</th>
                    <th className="p-3 text-left font-medium">Kanały</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitors.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 align-top"
                    >
                      <td className="p-3">
                        <span className="font-medium">{c.name}</span>
                        {c.type && (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {c.type}
                          </span>
                        )}
                      </td>
                      <MacierzKomorka value={c.strengthsMd} />
                      <MacierzKomorka value={c.weaknessesMd} />
                      <MacierzKomorka value={c.pricingMd} />
                      <MacierzKomorka value={c.channelsMd} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnalysisSection>
        </>
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

function MacierzKomorka({ value }: { value: string | null }) {
  return (
    <td className="p-3">
      {value ? (
        <AnalysisProse className="text-xs">{value}</AnalysisProse>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      )}
    </td>
  );
}

function CompetitorCard({ competitor: c }: { competitor: CompetitorAnalysis }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{c.name}</h4>
            {c.url && (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand underline underline-offset-2"
              >
                strona
                <ExternalLink className="size-3" />
              </a>
            )}
            {c.segmentName && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {c.segmentName}
              </span>
            )}
            {c.segmentMissing && (
              <span className="rounded-md border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-500">
                segment spoza tego projektu
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <GapList gaps={c.gaps} />
          </div>
        </div>
        {(c.quadrantX !== null || c.quadrantY !== null) && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            x {c.quadrantX ?? "—"} · y {c.quadrantY ?? "—"}
          </span>
        )}
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-card p-4">
          <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-500">
            Mocne strony
          </h5>
          {c.strengthsMd ? (
            <AnalysisProse>{c.strengthsMd}</AnalysisProse>
          ) : (
            <p className="text-xs text-muted-foreground/60">Nie opisano.</p>
          )}
        </div>
        <div className="bg-card p-4">
          <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-destructive">
            Słabe strony
          </h5>
          {c.weaknessesMd ? (
            <AnalysisProse>{c.weaknessesMd}</AnalysisProse>
          ) : (
            <p className="text-xs text-muted-foreground/60">Nie opisano.</p>
          )}
        </div>
      </div>

      {(c.pricingMd || c.channelsMd || c.notesMd) && (
        <div className="space-y-4 border-t border-border p-4">
          <AnalysisField label="Cennik" value={c.pricingMd} />
          <AnalysisField label="Kanały" value={c.channelsMd} />
          <AnalysisField label="Notatki" value={c.notesMd} />
        </div>
      )}
    </article>
  );
}
