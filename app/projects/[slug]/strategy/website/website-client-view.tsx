"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageSectionEditor } from "@/components/strategy-hub/page-section-editor";

interface PageItem {
  id: string;
  name: string;
  urlPath: string | null;
  status: string | null;
}

interface Props {
  projectId: string;
  pages: PageItem[];
}

export function WebsiteClientView({ projectId, pages }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pages[0]?.id ?? null);
  const selected = pages.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {pages.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-sm">Podstrony ({pages.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selectedId === p.id
                    ? "border-brand/40 bg-brand/5"
                    : "border-border bg-card/40 hover:border-border/80"
                )}
              >
                <span className="font-medium block">{p.name}</span>
                {p.urlPath && (
                  <code className="text-[10px] text-muted-foreground font-mono">
                    {p.urlPath}
                  </code>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <section className="space-y-3">
          <h2 className="font-medium text-sm">Sekcje strony — {selected.name}</h2>
          <PageSectionEditor
            projectId={projectId}
            pageId={selected.id}
            pageLabel={selected.name}
            mode="client"
          />
        </section>
      )}
    </div>
  );
}
