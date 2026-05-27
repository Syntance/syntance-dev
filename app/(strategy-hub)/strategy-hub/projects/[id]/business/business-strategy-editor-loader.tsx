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
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
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

interface Props {
  projectId: string;
  projectName: string;
  strategy: Strategy;
}

export function BusinessStrategyEditorLoader(props: Props) {
  return <BusinessStrategyEditor {...props} />;
}
