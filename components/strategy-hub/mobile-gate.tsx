"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonitorSmartphone, Target, NotebookPen } from "lucide-react";
import { useProjectIdFromPath } from "@/components/strategy-hub/project-context";

/** Trasy dozwolone na mobile (read-only podgląd + szybkie aktualizacje). */
const MOBILE_ALLOWED = [
  "/measurement/kpi",
  "/info/notes",
  "/canvas",
  "/measurement/review",
];

/**
 * Bramka mobilna — pełna edycja Strategy Hub wymaga pulpitu.
 * Na wąskich ekranach blokujemy edytory, ale przepuszczamy KPI, notatki
 * i podgląd canvas (wg specyfikacji responsywności).
 *
 * Renderowana jako overlay widoczny tylko poniżej `md`.
 */
export function MobileGate() {
  const projectId = useProjectIdFromPath();
  const pathname = usePathname();

  // Lista projektów / ekrany bez projektu — nie blokujemy.
  if (!projectId) return null;
  if (MOBILE_ALLOWED.some((seg) => pathname.includes(seg))) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-background p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
        <MonitorSmartphone className="size-6 text-brand" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">
          Otwórz na pulpicie
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Pełna edycja strategii — mapa, edytory, graf wpływu — wymaga szerokości
          pulpitu. Na telefonie dostępny jest podgląd oraz szybkie aktualizacje.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link
          href={`/strategy-hub/projects/${projectId}/measurement/kpi`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-brand/40 transition-colors"
        >
          <Target className="size-4 text-brand" />
          Aktualizuj KPI
        </Link>
        <Link
          href={`/strategy-hub/projects/${projectId}/info/notes`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-brand/40 transition-colors"
        >
          <NotebookPen className="size-4 text-brand" />
          Notatki
        </Link>
      </div>
    </div>
  );
}
