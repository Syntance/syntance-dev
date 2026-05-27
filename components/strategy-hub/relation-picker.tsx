"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, ArrowUpRight, Plus, Loader2 } from "lucide-react";
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
  | "user_flow";

export interface RelationOption {
  id: string;
  label: string;
  meta?: string;
}

interface RelationPickerProps {
  projectId: string;
  entityType: EntityType;
  cardinality: "single" | "multi";
  value: string | string[] | null;
  onChange: (next: string | string[] | null) => void;
  // context filters
  filterSegmentId?: string;
  placeholder?: string;
  required?: boolean;
  allowCreate?: boolean;
  onCreateNew?: (name: string) => Promise<RelationOption | null>;
  disabledIds?: string[];
  sortable?: boolean;
  label?: string;
  className?: string;
}

export function RelationPicker({
  projectId,
  entityType,
  cardinality,
  value,
  onChange,
  filterSegmentId,
  placeholder,
  required,
  allowCreate = false,
  onCreateNew,
  disabledIds = [],
  label,
  className,
}: RelationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<RelationOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
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
    [projectId, entityType, filterSegmentId]
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
    fetchOptions("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
    .map((id) => optionCache.get(id))
    .filter(Boolean) as RelationOption[];

  const labelText =
    placeholder ??
    `Wybierz ${entityType.replace(/_/g, " ")}${cardinality === "multi" ? " (multi)" : ""}`;

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
              className="gap-1 pr-1 max-w-[200px]"
            >
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
              <button
                type="button"
                className="ml-0 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  // Jump to entity — could open a drawer; for now opens a new tab
                  window.open(
                    `/strategy-hub/entities/${entityType}/${opt.id}`,
                    "_blank"
                  );
                }}
                aria-label={`Otwórz ${opt.label}`}
              >
                <ArrowUpRight className="h-3 w-3" />
              </button>
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
          className="w-[320px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Szukaj..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
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
                  {options.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    const isDisabled = disabledIds.includes(opt.id);
                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.id}
                        disabled={isDisabled}
                        onSelect={() => toggleId(opt.id)}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm">{opt.label}</div>
                          {opt.meta && (
                            <div className="truncate text-xs text-muted-foreground">
                              {opt.meta}
                            </div>
                          )}
                        </div>
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
                      Utwórz „{search}"
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
