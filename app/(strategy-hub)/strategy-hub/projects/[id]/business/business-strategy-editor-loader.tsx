"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const BusinessStrategyEditor = dynamic(
  () =>
    import("./business-strategy-editor").then((mod) => ({
      default: mod.BusinessStrategyEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col animate-pulse">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border p-3 space-y-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    ),
  }
);

interface Strategy {
  projectId: string;
  goalsMd: string | null;
  uvpMd: string | null;
  competitorsMd: string | null;
  objectionsMd: string | null;
}

interface ProblemRow {
  id: string;
  problemMd: string;
  ambitionMd: string | null;
  ourSolutionMd: string | null;
  priority: number;
  orderIdx: number | null;
}

interface ObjectionRow {
  id: string;
  objectionMd: string;
  responseMd: string | null;
  proofMd: string | null;
  priority: number;
  orderIdx: number | null;
  stage: string | null;
  status: string | null;
}

interface UvpRow {
  projectId: string;
  coreUvpMd: string | null;
  valueAddsJson: string | null;
}

interface PositioningRow {
  projectId: string;
  axisXLabel: string | null;
  axisYLabel: string | null;
  ourX: number | null;
  ourY: number | null;
  ourLabel: string | null;
  competitorsOnQuadrant: unknown;
  statementMd: string | null;
}

interface CompetitorRow {
  id: string;
  name: string;
  url: string | null;
  type: string;
  strengthsMd: string | null;
  weaknessesMd: string | null;
  pricingMd: string | null;
  channelsMd: string | null;
  notesMd: string | null;
  quadrantX: number | null;
  quadrantY: number | null;
}

interface Props {
  projectId: string;
  projectName: string;
  strategy: Strategy;
  problems: ProblemRow[];
  objections: ObjectionRow[];
  uvp: UvpRow;
  positioning: PositioningRow;
  competitors: CompetitorRow[];
}

export function BusinessStrategyEditorLoader(props: Props) {
  return <BusinessStrategyEditor {...props} />;
}
