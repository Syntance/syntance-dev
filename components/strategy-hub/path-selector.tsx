"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  GitBranch,
  Plus,
  Check,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyPath {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  orderIdx: number;
}

interface PathSelectorProps {
  projectId: string;
}

const PATH_COLORS = [
  { label: "Niebieski", value: "oklch(0.6 0.15 240)" },
  { label: "Zielony", value: "oklch(0.6 0.15 140)" },
  { label: "Pomarańczowy", value: "oklch(0.65 0.18 55)" },
  { label: "Różowy", value: "oklch(0.65 0.18 340)" },
  { label: "Fioletowy", value: "oklch(0.6 0.18 280)" },
  { label: "Cyjan", value: "oklch(0.6 0.15 195)" },
];

export function PathSelector({ projectId }: PathSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePathId = searchParams.get("pathId");

  const [paths, setPaths] = useState<StrategyPath[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PATH_COLORS[0].value);
  const [editName, setEditName] = useState("");
  const [, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activePath = paths.find((p) => p.id === activePathId);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function setPath(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("pathId", id);
    else params.delete("pathId");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
    setOpen(false);
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
      setCreating(false);
      setPath(d.path.id);
    }
  }

  async function updatePath(pathId: string, name: string) {
    const res = await fetch(
      `/api/strategy-hub/projects/${projectId}/paths/${pathId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
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
      if (activePathId === pathId) setPath(null);
    }
  }

  return (
    <div ref={dropdownRef} className="relative px-2 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm",
          "border border-sidebar-border bg-sidebar-accent/30",
          "hover:bg-sidebar-accent/60 transition-colors",
          "group-data-[collapsible=icon]:justify-center"
        )}
        aria-label="Wybierz ścieżkę strategii"
      >
        <GitBranch
          className="size-3.5 shrink-0"
          style={{ color: activePath?.color ?? "var(--muted-foreground)" }}
        />
        <span className="flex-1 text-left truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : activePath ? (
            activePath.name
          ) : (
            "Wszystkie ścieżki"
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/60 transition-transform group-data-[collapsible=icon]:hidden",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-2 right-2 z-50 mt-1 rounded-md border border-border",
            "bg-popover shadow-lg overflow-hidden"
          )}
        >
          {/* Opcja "Wszystkie" */}
          <button
            type="button"
            onClick={() => setPath(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors",
              !activePathId && "bg-muted/40"
            )}
          >
            <GitBranch className="size-3.5 text-muted-foreground" />
            <span className="flex-1 text-left">Wszystkie ścieżki</span>
            {!activePathId && <Check className="size-3 text-brand" />}
          </button>

          {paths.length > 0 && (
            <div className="border-t border-border/50">
              {paths.map((path) => (
                <div
                  key={path.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors",
                    activePathId === path.id && "bg-muted/40"
                  )}
                >
                  {editingId === path.id ? (
                    <form
                      className="flex flex-1 gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        updatePath(path.id, editName);
                      }}
                    >
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                      />
                      <button
                        type="submit"
                        className="size-6 flex items-center justify-center rounded hover:bg-muted"
                      >
                        <Check className="size-3 text-brand" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="size-6 flex items-center justify-center rounded hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setPath(path.id)}
                        className="flex flex-1 items-center gap-2 text-left min-w-0"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: path.color ?? "var(--muted-foreground)" }}
                        />
                        <span className="truncate">{path.name}</span>
                      </button>
                      {activePathId === path.id && (
                        <Check className="size-3 text-brand shrink-0" />
                      )}
                      <button
                        type="button"
                        title="Zmień nazwę"
                        onClick={() => {
                          setEditingId(path.id);
                          setEditName(path.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-opacity"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        title="Usuń ścieżkę"
                        onClick={() => deletePath(path.id)}
                        className="opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nowa ścieżka */}
          <div className="border-t border-border/50">
            {creating ? (
              <form
                className="flex flex-col gap-2 p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  createPath();
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nazwa ścieżki…"
                  className="h-7 w-full rounded border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="h-6 px-2 text-xs rounded hover:bg-muted text-muted-foreground"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="h-6 px-2 text-xs rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-50"
                  >
                    Utwórz
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Plus className="size-3.5" />
                Nowa ścieżka
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
