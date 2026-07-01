"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Route, Plus, Check, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StrategyPath {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean | null;
}

/**
 * Przełącznik ścieżek strategii (Tracks). Pozwala wybrać aktywną ścieżkę
 * (filtruje mapę przez ?path=), tworzyć nowe i usuwać.
 */
export function TrackSwitcher({
  projectId,
  activePathId,
}: {
  projectId: string;
  activePathId: string | null;
}) {
  const base = `/api/strategy-hub/projects/${projectId}/paths`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [paths, setPaths] = React.useState<StrategyPath[]>([]);
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    fetch(base, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : { paths: [] }))
      .then((j: { paths?: StrategyPath[] }) => setPaths(j.paths ?? []))
      .catch(() => {});
  }, [base]);

  React.useEffect(() => {
    load();
  }, [load]);

  const navigateTo = React.useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (id) sp.set("path", id);
      else sp.delete("path");
      const qs = sp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
      setOpen(false);
    },
    [pathname, router, searchParams]
  );

  const create = React.useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const { path } = (await res.json()) as { path: StrategyPath };
        setPaths((prev) => [...prev, path]);
        setNewName("");
        setCreating(false);
        navigateTo(path.id);
      }
    } finally {
      setBusy(false);
    }
  }, [base, newName, navigateTo]);

  const remove = React.useCallback(
    async (id: string) => {
      setPaths((prev) => prev.filter((p) => p.id !== id));
      if (activePathId === id) navigateTo(null);
      await fetch(`${base}/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [base, activePathId, navigateTo]
  );

  const active = paths.find((p) => p.id === activePathId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand/40"
        >
          <Route className="size-3.5 text-brand" />
          <span>{active ? active.name : "Wszystkie ścieżki"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <button
          type="button"
          onClick={() => navigateTo(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
            !activePathId && "text-brand"
          )}
        >
          <span className="flex size-4 items-center justify-center">
            {!activePathId && <Check className="size-3.5" />}
          </span>
          Wszystkie ścieżki
        </button>

        {paths.map((p) => (
          <div
            key={p.id}
            className="group flex items-center gap-1 rounded-md hover:bg-muted"
          >
            <button
              type="button"
              onClick={() => navigateTo(p.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm",
                activePathId === p.id && "text-brand"
              )}
            >
              <span className="flex size-4 items-center justify-center">
                {activePathId === p.id ? (
                  <Check className="size-3.5" />
                ) : (
                  <span className="text-xs">{p.icon ?? "•"}</span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
            </button>
            <button
              type="button"
              onClick={() => void remove(p.id)}
              className="mr-1 rounded p-1 text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive"
              aria-label={`Usuń ścieżkę ${p.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        <div className="my-1 border-t border-border" />

        {creating ? (
          <div className="flex items-center gap-1 p-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Nazwa ścieżki…"
              className="h-8 text-sm"
            />
            <Button type="button" size="icon" className="size-8" disabled={busy} onClick={() => void create()}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Nowa ścieżka
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
