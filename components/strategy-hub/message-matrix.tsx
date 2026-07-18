import Link from "next/link";
import { AlertTriangle, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralCount } from "@/lib/strategy-hub/pluralize";
import type { MessageMatrix } from "@/lib/strategy-hub/message-matrix";

/**
 * Macierz przekazu (RSC, read-only): wiersz = segment, chipy = etapy JEGO
 * podróży zakupowej. Komórka etapu pokazuje, czym odpowiadamy (treści +
 * pitche/skrypty/magnety). Pusta = luka przekazu → link do edytora.
 */

const TYPE_DOT: Record<string, string> = {
  element: "bg-emerald-500",
  sales_pitch: "bg-orange-500",
  sales_script: "bg-red-500",
  lead_magnet: "bg-amber-500",
};

export function MessageMatrixSection({
  projectId,
  matrix,
}: {
  projectId: string;
  matrix: MessageMatrix;
}) {
  if (matrix.rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="size-4 text-brand" />
          <h2 className="text-sm font-semibold tracking-tight">
            Macierz przekazu — segment × etap zakupu
          </h2>
        </div>
        {matrix.gapCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">
            <AlertTriangle className="size-3" />
            {pluralCount(matrix.gapCount, "etap bez przekazu", "etapy bez przekazu", "etapów bez przekazu")}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            każdy etap ma przekaz ✓
          </span>
        )}
      </div>

      <div className="space-y-3">
        {matrix.rows.map((row) => (
          <div key={row.segmentId} className="space-y-1.5">
            <p className="text-xs font-medium">
              {row.icon ? `${row.icon} ` : ""}
              {row.segmentName}
            </p>
            {row.cells.length === 0 ? (
              <p className="text-[11px] text-amber-600">
                brak podróży zakupowej —{" "}
                <Link
                  href={`/strategy-hub/projects/${projectId}/market/journey`}
                  className="underline"
                >
                  zdefiniuj etapy
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {row.cells.map((cell, i) => (
                  <Link
                    key={cell.stageId}
                    href={
                      cell.isGap
                        ? `/strategy-hub/projects/${projectId}/execution/funnel`
                        : `/strategy-hub/projects/${projectId}/constellation?level=entity&type=stage&id=${cell.stageId}`
                    }
                    title={
                      cell.isGap
                        ? `LUKA: brak przekazu na etap „${cell.stageName}"${
                            cell.questions ? ` — pytania klienta: ${cell.questions}` : ""
                          }`
                        : cell.items.map((it) => it.label).join(" · ")
                    }
                    className={cn(
                      "group inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                      cell.isGap
                        ? "border-dashed border-amber-500/60 text-amber-600 hover:bg-amber-500/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="font-medium text-foreground/70">{i + 1}.</span>
                    <span className="truncate">{cell.stageName}</span>
                    {cell.isGap ? (
                      <span className="shrink-0 font-semibold">luka</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-0.5">
                        {cell.items.slice(0, 5).map((it) => (
                          <span
                            key={`${it.type}:${it.id}`}
                            className={cn(
                              "size-1.5 rounded-full",
                              TYPE_DOT[it.type] ?? "bg-muted-foreground"
                            )}
                          />
                        ))}
                        {cell.items.length > 5 && (
                          <span className="text-[9px]">+{cell.items.length - 5}</span>
                        )}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        kropki: <span className="text-emerald-600">treść</span> ·{" "}
        <span className="text-orange-600">pitch</span> ·{" "}
        <span className="text-red-600">skrypt</span> ·{" "}
        <span className="text-amber-600">lead magnet</span> — najedź na etap, aby
        zobaczyć listę
      </p>
    </section>
  );
}
