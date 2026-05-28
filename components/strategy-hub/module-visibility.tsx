"use client";

import { Eye } from "lucide-react";
import {
  VisibilityControl,
  type VisibilityStatus,
} from "@/components/strategy-hub/visibility-control";

export interface ModuleVisibilityItem {
  key: string;
  label: string;
  status: VisibilityStatus;
}

/**
 * Panel sterowania widocznością modułów dla klienta (scope="module").
 * Render na Strategy Canvas. Domyślnie każdy moduł jest widoczny.
 */
export function ModuleVisibility({
  projectId,
  modules,
}: {
  projectId: string;
  modules: ModuleVisibilityItem[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-brand" />
        <h2 className="text-sm font-medium">Widoczność modułów dla klienta</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Steruj, które moduły widzi klient w dashboardzie na syntance.dev.
        „W budowie” pokazuje etykietę zamiast treści.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((m) => (
          <div
            key={m.key}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
          >
            <span className="text-sm truncate">{m.label}</span>
            <VisibilityControl
              projectId={projectId}
              scope="module"
              entityType={m.key}
              initialStatus={m.status}
              variant="chip"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
