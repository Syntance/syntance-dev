import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  MarketAnalysis,
  MarketSegmentAnalysis,
} from "@/lib/strategy-hub/market-analysis";
import {
  AnalysisField,
  AnalysisProse,
  AnalysisSection,
  AnalysisStat,
  EmptyAnalysis,
  GapList,
  ScoreBar,
} from "@/components/strategy-hub/analysis-primitives";

const PRIORITY_LABELS: Record<number, string> = {
  1: "Niski",
  2: "Średni",
  3: "Wysoki",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Niskie",
  medium: "Średnie",
  high: "Wysokie",
};

/**
 * Widok „Analiza rynku" — czyta się go z góry na dół jak dokument:
 * najpierw skala i kryteria podziału, potem segmenty w kolejności atrakcyjności,
 * a w każdym segmencie najpierw liczby, potem to, co o nim wiemy.
 */
export function MarketAnalysisView({
  data,
  projectId,
}: {
  data: MarketAnalysis;
  projectId: string;
}) {
  if (data.segmentCount === 0) {
    return (
      <EmptyAnalysis
        title="Brak segmentów do analizy"
        description="Analiza rynku czyta dane z segmentów — dodaj pierwszy segment, a pojawi się tu jego wielkość rynku, scoring i ryzyka."
        href={`/strategy-hub/projects/${projectId}/market/segments`}
        linkLabel="Przejdź do segmentów"
      />
    );
  }

  const udzialNiepelny =
    data.revenueSharePctTotal !== null &&
    Math.abs(data.revenueSharePctTotal - 100) > 1;

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalysisStat label="Segmenty" value={data.segmentCount} />
        <AnalysisStat
          label="Udział w przychodzie"
          value={
            data.revenueSharePctTotal === null
              ? "—"
              : `${data.revenueSharePctTotal}%`
          }
          hint={
            data.revenueSharePctTotal === null
              ? "nie uzupełniono"
              : udzialNiepelny
                ? "suma nie domyka się do 100%"
                : "suma się domyka"
          }
          alarm={udzialNiepelny}
        />
        <AnalysisStat
          label="Bez wielkości rynku"
          value={data.withoutMarketData}
          hint={
            data.withoutMarketData > 0
              ? "segmenty bez TAM/SAM/SOM"
              : "wszystkie oszacowane"
          }
          alarm={data.withoutMarketData > 0}
        />
        <AnalysisStat
          label="Kryteria podziału"
          value={data.dimensions.length}
          hint={data.dimensions.length === 0 ? "nie zdefiniowano" : "wymiarów"}
        />
      </section>

      {(data.dimensions.length > 0 || data.criteriaNotesMd) && (
        <AnalysisSection
          title="Jak dzielimy rynek"
          hint="Wymiary, według których powstały segmenty — bez nich podział jest nieweryfikowalny."
          action={
            <Link
              href={`/strategy-hub/projects/${projectId}/market/segmentation`}
              className="shrink-0 text-xs text-brand underline underline-offset-2"
            >
              Edytuj kryteria
            </Link>
          }
        >
          {data.dimensions.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.dimensions.map((d) => (
                <div
                  key={d.dimension}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <h3 className="text-sm font-medium">{d.dimension}</h3>
                  {d.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                  {d.values.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {d.values.map((v) => (
                        <span
                          key={v}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px]"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <AnalysisField label="Notatki" value={data.criteriaNotesMd} />
        </AnalysisSection>
      )}

      <AnalysisSection
        title="Segmenty według atrakcyjności"
        hint="Kolejność wynika ze scoringu; segmenty bez oceny są na końcu, a nie na dnie rankingu."
        action={
          <Link
            href={`/strategy-hub/projects/${projectId}/market/segments`}
            className="shrink-0 text-xs text-brand underline underline-offset-2"
          >
            Edytuj segmenty
          </Link>
        }
      >
        <div className="space-y-4">
          {data.segments.map((s, i) => (
            <SegmentCard key={s.id} segment={s} rank={i + 1} />
          ))}
        </div>
      </AnalysisSection>
    </div>
  );
}

function SegmentCard({
  segment: s,
  rank,
}: {
  segment: MarketSegmentAnalysis;
  rank: number;
}) {
  const maZawartosc =
    s.jtbdMd ||
    s.problemMd ||
    s.demographicsMd ||
    s.budgetMd ||
    s.segmentPricingMd ||
    s.triggersMd ||
    s.blockersMd ||
    s.mentalityMd ||
    s.emotionalDriversMd;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-start gap-3 border-b border-border p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
          {s.icon ?? "👥"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              #{rank}
            </span>
            <h3 className="text-sm font-semibold">{s.name}</h3>
            {s.code && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {s.code}
              </span>
            )}
            {s.priority !== null && (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px]">
                Priorytet: {PRIORITY_LABELS[s.priority] ?? s.priority}
              </span>
            )}
          </div>
          {s.personaName && (
            <p className="mt-0.5 text-xs text-muted-foreground">{s.personaName}</p>
          )}
          <div className="mt-2">
            <GapList gaps={s.gaps} />
          </div>
        </div>
        {s.revenueSharePct !== null && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums">
              {s.revenueSharePct}%
            </p>
            <p className="text-[10px] text-muted-foreground">przychodu</p>
          </div>
        )}
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-5 lg:order-1">
          <AnalysisField label="Wielkość rynku" value={s.marketSizeMd} />
          <AnalysisField label="Job to be done" value={s.jtbdMd} />
          <AnalysisField label="Problem" value={s.problemMd} />
          <AnalysisField label="Demografia" value={s.demographicsMd} />
          <AnalysisField label="Budżet" value={s.budgetMd} />
          <AnalysisField label="Pricing dla segmentu" value={s.segmentPricingMd} />
          <AnalysisField label="Triggery zakupowe" value={s.triggersMd} />
          <AnalysisField label="Blokery" value={s.blockersMd} />
          <AnalysisField label="Mentalność" value={s.mentalityMd} />
          <AnalysisField label="Sterowniki emocjonalne" value={s.emotionalDriversMd} />

          {!maZawartosc && !s.marketSizeMd && (
            <p className="text-xs text-muted-foreground">
              Ten segment nie ma jeszcze opisu — zostaje sama nazwa.
            </p>
          )}

          {(s.quickWins.length > 0 || s.risks.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {s.quickWins.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Quick winy
                  </h4>
                  <ul className="space-y-2">
                    {s.quickWins.map((w) => (
                      <li
                        key={w.id}
                        className="rounded-lg border border-border bg-background/40 p-2.5"
                      >
                        <p className="text-xs font-medium">{w.title}</p>
                        {w.descriptionMd && (
                          <AnalysisProse className="mt-1 text-xs">
                            {w.descriptionMd}
                          </AnalysisProse>
                        )}
                        {w.status && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {w.status}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.risks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ryzyka
                  </h4>
                  <ul className="space-y-2">
                    {s.risks.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5"
                      >
                        <AnalysisProse className="text-xs">{r.riskMd}</AnalysisProse>
                        {r.mitigationMd && (
                          <div className="mt-1.5 border-t border-destructive/15 pt-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Mitygacja
                            </p>
                            <AnalysisProse className="text-xs">
                              {r.mitigationMd}
                            </AnalysisProse>
                          </div>
                        )}
                        {r.severity && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Waga: {SEVERITY_LABELS[r.severity] ?? r.severity}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:order-2">
          {(s.scoring.total !== null ||
            s.scoring.fit !== null ||
            s.scoring.value !== null ||
            s.scoring.effort !== null) && (
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Scoring
                </h4>
                {s.scoring.total !== null && (
                  <span className="text-sm font-semibold tabular-nums">
                    {s.scoring.total}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <ScoreBar label="Fit" score={s.scoring.fit} />
                <ScoreBar label="Wartość" score={s.scoring.value} />
                <ScoreBar label="Wysiłek" score={s.scoring.effort} />
              </div>
            </div>
          )}

          {s.marketData.length > 0 && (
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Wielkość rynku
              </h4>
              <dl className="space-y-2">
                {s.marketData.map((d) => (
                  <div key={d.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-muted-foreground">{d.label}</dt>
                      <dd className="text-xs font-medium tabular-nums">{d.value}</dd>
                    </div>
                    {d.source && (
                      <p className="text-[10px] text-muted-foreground/70">
                        źródło: {d.source}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          )}

          {s.status && (
            <p
              className={cn(
                "text-[11px]",
                s.status === "active" ? "text-muted-foreground" : "text-amber-500"
              )}
            >
              Status: {s.status}
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
