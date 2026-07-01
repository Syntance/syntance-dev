"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  X,
  ArrowUpRight,
  Plus,
  Loader2,
  Sparkles,
  GripVertical,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type EntityType =
  | "segment"
  | "purchase_stage"
  | "funnel_element"
  | "channel"
  | "kpi"
  | "page"
  | "user_flow"
  | "campaign"
  | "geo"
  | "offer"
  | "analytics_event"
  | "objection"
  | "pitch"
  | "lead_magnet"
  | "seo_keyword"
  | "page_section";

export interface RelationOption {
  id: string;
  label: string;
  meta?: string;
  /** Uzasadnienie sugestii AI ("Polecane na podstawie…"), tylko dla aiSuggestions. */
  reason?: string;
}

interface RelationPickerProps {
  projectId: string;
  entityType: EntityType;
  cardinality: "single" | "multi";
  value: string | string[] | null;
  onChange: (next: string | string[] | null) => void;
  // filtry kontekstowe (macierz relacji per encja — Faza 2)
  filterSegmentId?: string;
  filterStageId?: string;
  filterPhase?: string;
  /** Filtr po podstronie — używany przez `entityType="page_section"` (sekcje należą do jednej strony). */
  filterPageId?: string;
  placeholder?: string;
  required?: boolean;
  allowCreate?: boolean;
  onCreateNew?: (name: string) => Promise<RelationOption | null>;
  disabledIds?: string[];
  /** Włącza drag-reorder chipów (tylko cardinality="multi"). */
  sortable?: boolean;
  label?: string;
  className?: string;
  /** Sugestie AI pokazywane na górze listy przed wyszukiwaniem („Polecane na podstawie…"). */
  aiSuggestions?: RelationOption[];
  aiContext?: string;
  /** Callback „skok do encji" (strzałka) — jeśli brak, przycisk nie jest renderowany. */
  onJumpTo?: (opt: RelationOption) => void;
  /** Treść mini-karty podglądu na hover; domyślnie pokazuje `meta`. */
  renderPreview?: (opt: RelationOption) => React.ReactNode;
}

function highlightMatch(label: string, query: string): React.ReactNode {
  if (!query.trim()) return label;
  const idx = label.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return label;
  const before = label.slice(0, idx);
  const match = label.slice(idx, idx + query.trim().length);
  const after = label.slice(idx + query.trim().length);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-primary/20 text-inherit">{match}</mark>
      {after}
    </>
  );
}

export function RelationPicker({
  projectId,
  entityType,
  cardinality,
  value,
  onChange,
  filterSegmentId,
  filterStageId,
  filterPhase,
  filterPageId,
  placeholder,
  required,
  allowCreate = false,
  onCreateNew,
  disabledIds = [],
  sortable = false,
  label,
  className,
  aiSuggestions,
  aiContext,
  onJumpTo,
  renderPreview,
}: RelationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<RelationOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout>>(null);

  const selectedIds = React.useMemo<string[]>(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Keep a local cache of id→label for selected chips (so they survive between fetches)
  const [optionCache, setOptionCache] = React.useState<Map<string, RelationOption>>(
    new Map()
  );

  const fetchOptions = React.useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: entityType, q });
        if (filterSegmentId) params.set("segmentId", filterSegmentId);
        if (filterStageId) params.set("stageId", filterStageId);
        if (filterPhase) params.set("phase", filterPhase);
        if (filterPageId) params.set("pageId", filterPageId);
        const res = await fetch(
          `/api/strategy-hub/projects/${projectId}/entities?${params}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const results: RelationOption[] = data.results ?? [];
        setOptions(results);
        setOptionCache((prev) => {
          const next = new Map(prev);
          results.forEach((o) => next.set(o.id, o));
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [projectId, entityType, filterSegmentId, filterStageId, filterPhase, filterPageId]
  );

  React.useEffect(() => {
    if (!open) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchOptions(search), 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [open, search, fetchOptions]);

  // Load labels for pre-selected IDs on first open
  React.useEffect(() => {
    if (!open) return;
    const missing = selectedIds.filter((id) => !optionCache.has(id));
    if (missing.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ładowanie etykiet dla pre-selected ID przy pierwszym otwarciu
    fetchOptions("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveOption = React.useCallback(
    (id: string): RelationOption | undefined =>
      optionCache.get(id) ?? aiSuggestions?.find((s) => s.id === id),
    [optionCache, aiSuggestions]
  );

  function toggleId(id: string) {
    if (cardinality === "single") {
      onChange(selectedIds[0] === id ? null : id);
      setOpen(false);
      return;
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next.length ? next : null);
  }

  function removeId(id: string) {
    if (cardinality === "single") {
      onChange(null);
      return;
    }
    const next = selectedIds.filter((x) => x !== id);
    onChange(next.length ? next : null);
  }

  function selectAllVisible() {
    if (cardinality !== "multi") return;
    const visibleIds = options.map((o) => o.id).filter((id) => !disabledIds.includes(id));
    const merged = Array.from(new Set([...selectedIds, ...visibleIds]));
    onChange(merged.length ? merged : null);
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIdx = selectedIds.indexOf(fromId);
    const toIdx = selectedIds.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...selectedIds];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, fromId);
    onChange(next);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && search === "" && selectedIds.length > 0) {
      e.preventDefault();
      removeId(selectedIds[selectedIds.length - 1]);
    }
  }

  async function handleCreateNew() {
    if (!onCreateNew || !search.trim()) return;
    setCreating(true);
    try {
      const created = await onCreateNew(search.trim());
      if (!created) return;
      setOptionCache((prev) => new Map(prev).set(created.id, created));
      toggleId(created.id);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  const selectedOptions = selectedIds
    .map((id) => resolveOption(id))
    .filter(Boolean) as RelationOption[];

  const labelText =
    placeholder ??
    `Wybierz ${entityType.replace(/_/g, " ")}${cardinality === "multi" ? " (multi)" : ""}`;

  const visibleSuggestions = (aiSuggestions ?? []).filter(
    (s) => !search.trim() && !selectedIds.includes(s.id)
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}

      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.id}
              variant="secondary"
              draggable={sortable && cardinality === "multi"}
              onDragStart={() => setDragId(opt.id)}
              onDragOver={(e) => {
                if (sortable && cardinality === "multi") e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) reorder(dragId, opt.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                "gap-1 pr-1 max-w-[200px]",
                sortable && cardinality === "multi" && "cursor-grab active:cursor-grabbing",
                dragId === opt.id && "opacity-50"
              )}
            >
              {sortable && cardinality === "multi" && (
                <GripVertical className="h-3 w-3 opacity-40" />
              )}
              <span className="truncate">{opt.label}</span>
              <button
                type="button"
                className="ml-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeId(opt.id);
                }}
                aria-label={`Usuń ${opt.label}`}
              >
                <X className="h-3 w-3" />
              </button>
              {onJumpTo && (
                <button
                  type="button"
                  className="ml-0 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpTo(opt);
                  }}
                  aria-label={`Otwórz ${opt.label}`}
                >
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between h-8 text-xs font-normal",
              required && selectedIds.length === 0 && "border-destructive"
            )}
          >
            <span className="truncate text-muted-foreground">{labelText}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[340px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Szukaj… (Backspace usuwa ostatni)"
              value={search}
              onValueChange={setSearch}
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              {visibleSuggestions.length > 0 && (
                <>
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1 text-primary">
                        <Sparkles className="h-3 w-3" />
                        Sugestie AI{aiContext ? ` — polecane na podstawie ${aiContext}` : ""}
                      </span>
                    }
                  >
                    {visibleSuggestions.map((opt) => (
                      <CommandItem
                        key={`ai-${opt.id}`}
                        value={`ai-${opt.id}`}
                        onSelect={() => toggleId(opt.id)}
                        className="group relative flex items-center gap-2"
                        onMouseEnter={() => setHoveredId(opt.id)}
                        onMouseLeave={() => setHoveredId((h) => (h === opt.id ? null : h))}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm">{opt.label}</div>
                          {opt.reason && (
                            <div className="truncate text-xs text-muted-foreground">
                              {opt.reason}
                            </div>
                          )}
                        </div>
                        {hoveredId === opt.id && (
                          <div className="absolute left-full top-0 z-50 ml-1 w-56 rounded-md border bg-popover p-2 text-xs shadow-md">
                            {renderPreview ? renderPreview(opt) : (opt.meta ?? opt.label)}
                          </div>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && options.length === 0 && (
                <CommandEmpty>Brak wyników{search ? ` dla „${search}"` : ""}</CommandEmpty>
              )}
              {!loading && options.length > 0 && (
                <CommandGroup>
                  {cardinality === "multi" && options.length > 1 && (
                    <CommandItem
                      value="__select_all__"
                      onSelect={selectAllVisible}
                      className="text-muted-foreground"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Zaznacz wszystkie widoczne ({options.length})
                    </CommandItem>
                  )}
                  {options.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    const isDisabled = disabledIds.includes(opt.id);
                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.id}
                        disabled={isDisabled}
                        onSelect={() => toggleId(opt.id)}
                        className="group relative flex items-center gap-2"
                        onMouseEnter={() => setHoveredId(opt.id)}
                        onMouseLeave={() => setHoveredId((h) => (h === opt.id ? null : h))}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm">
                            {highlightMatch(opt.label, search)}
                          </div>
                          {opt.meta && (
                            <div className="truncate text-xs text-muted-foreground">
                              {opt.meta}
                            </div>
                          )}
                        </div>
                        {hoveredId === opt.id && (
                          <div className="absolute left-full top-0 z-50 ml-1 w-56 rounded-md border bg-popover p-2 text-xs shadow-md">
                            {renderPreview
                              ? renderPreview(opt)
                              : (opt.meta ?? "Brak dodatkowych informacji")}
                          </div>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {allowCreate && onCreateNew && search.trim() && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={`create-${search}`}
                      onSelect={handleCreateNew}
                      disabled={creating}
                      className="text-primary"
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Utwórz „{search}”
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
