"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StrategyPath {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  orderIdx: number;
}

const PATH_COLORS = [
  { label: "Niebieski", value: "oklch(0.6 0.15 240)" },
  { label: "Zielony", value: "oklch(0.6 0.15 140)" },
  { label: "Pomarańczowy", value: "oklch(0.65 0.18 55)" },
  { label: "Różowy", value: "oklch(0.65 0.18 340)" },
  { label: "Fioletowy", value: "oklch(0.6 0.18 280)" },
  { label: "Cyjan", value: "oklch(0.6 0.15 195)" },
];

export function StrategyPathsManager({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePathId = searchParams.get("pathId");

  const [paths, setPaths] = useState<StrategyPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PATH_COLORS[0].value);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const load = useCallback(() => {
    fetch(`/api/strategy-hub/projects/${projectId}/paths`, {
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPaths(d.paths ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function activatePath(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("pathId", id);
    else params.delete("pathId");
    router.push(`${pathname}?${params.toString()}`);
  }

  async function createPath() {
    if (!newName.trim()) return;
    const res = await fetch(`/api/strategy-hub/projects/${projectId}/paths`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        color: newColor,
        orderIdx: paths.length,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setPaths((prev) => [...prev, d.path]);
      setNewName("");
      setNewColor(PATH_COLORS[0].value);
      setCreating(false);
    }
  }

  async function updatePath(pathId: string) {
    if (!editName.trim()) return;
    const res = await fetch(
      `/api/strategy-hub/projects/${projectId}/paths/${pathId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      }
    );
    if (res.ok) {
      const d = await res.json();
      setPaths((prev) =>
        prev.map((p) => (p.id === pathId ? { ...p, ...d.path } : p))
      );
      setEditingId(null);
    }
  }

  async function deletePath(pathId: string) {
    const res = await fetch(
      `/api/strategy-hub/projects/${projectId}/paths/${pathId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setPaths((prev) => prev.filter((p) => p.id !== pathId));
      if (activePathId === pathId) activatePath(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="size-3.5 animate-spin" />
        Ładowanie ścieżek…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {paths.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground py-1">
          Brak ścieżek — wszystkie dane projektu są wspólne.
        </p>
      )}

      <div className="space-y-2">
        {paths.map((path) => (
          <div
            key={path.id}
            className={cn(
              "group flex items-center gap-3 rounded-lg border p-3 transition-colors",
              activePathId === path.id
                ? "border-brand/40 bg-brand/5"
                : "border-border bg-card/50 hover:border-border"
            )}
          >
            {editingId === path.id ? (
              <form
                className="flex flex-1 flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  updatePath(path.id);
                }}
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PATH_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setEditColor(c.value)}
                      className={cn(
                        "size-5 rounded-full border-2 transition-transform",
                        editColor === c.value
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="h-7 text-xs">
                    <Check className="size-3 mr-1" />
                    Zapisz
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-3 mr-1" />
                    Anuluj
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      path.color ?? "var(--muted-foreground)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{path.name}</div>
                  {activePathId === path.id && (
                    <div className="text-xs text-brand">Aktywna ścieżka</div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    title="Aktywuj"
                    onClick={() =>
                      activatePath(activePathId === path.id ? null : path.id)
                    }
                    className={cn(
                      "size-7 flex items-center justify-center rounded text-xs font-medium transition-colors",
                      activePathId === path.id
                        ? "bg-brand/20 text-brand"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <ArrowRight className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Zmień nazwę"
                    onClick={() => {
                      setEditingId(path.id);
                      setEditName(path.name);
                      setEditColor(path.color ?? PATH_COLORS[0].value);
                    }}
                    className="size-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Usuń ścieżkę"
                    onClick={() => deletePath(path.id)}
                    className="size-7 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {creating ? (
        <form
          className="flex flex-col gap-2 rounded-lg border border-dashed border-brand/30 bg-brand/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            createPath();
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nazwa ścieżki, np. Rynek B2B…"
            className="h-8 w-full rounded border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {PATH_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setNewColor(c.value)}
                className={cn(
                  "size-5 rounded-full border-2 transition-transform",
                  newColor === c.value
                    ? "border-foreground scale-110"
                    : "border-transparent"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={!newName.trim()}>
              <Check className="size-3 mr-1" />
              Utwórz
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
            >
              <X className="size-3 mr-1" />
              Anuluj
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Plus className="size-3.5" />
          Dodaj ścieżkę strategii
        </button>
      )}
    </div>
  );
}
