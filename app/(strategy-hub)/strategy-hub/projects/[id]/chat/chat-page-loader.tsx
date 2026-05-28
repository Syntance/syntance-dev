"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ChatPanel = dynamic(
  () =>
    import("@/components/strategy-hub/chat/chat-panel").then((m) => ({
      default: m.ChatPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 shrink-0">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-36" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="shrink-0 px-4 py-3 border-t border-border/60">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    ),
  }
);

interface Props {
  projectId: string;
  projectName: string;
}

export function ChatPageLoader({ projectId, projectName }: Props) {
  return <ChatPanel projectId={projectId} projectName={projectName} />;
}
