"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";
import type {
  StrategyNode,
  MapSubcategory,
} from "@/lib/strategy-hub/strategy-map-types";

interface ListViewProps {
  nodes: StrategyNode[];
  mode: "editor" | "client";
}

/** Widok 1 — outline drzewa modułów strategicznych ze statusami. */
export function ListView({ nodes, mode }: ListViewProps) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
      {nodes.map((node) => (
        <NodeRow key={node.key} node={node} mode={mode} />
      ))}
    </div>
  );
}

function NodeRow({
  node,
  mode,
}: {
  node: StrategyNode;
  mode: "editor" | "client";
}) {
  const [open, setOpen] = useState(false);
  const total = node.subcategories.reduce((acc, s) => acc + s.count, 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="text-lg leading-none">{node.icon}</span>
        <StatusDot status={node.status} mode={mode} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {node.label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {total > 0 ? `${total} poz.` : "—"}
        </span>
        {mode === "editor" && (
          <Link
            href={node.href}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-brand group-hover:opacity-100"
            aria-label={`Otwórz edytor: ${node.label}`}
          >
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 pl-11">
          {node.subcategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak danych.</p>
          ) : (
            node.subcategories.map((sub) => (
              <SubRow key={sub.id} sub={sub} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SubRow({ sub }: { sub: MapSubcategory }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-foreground/80">
          {sub.label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {sub.count}
        </span>
      </div>
      {sub.items.length > 0 ? (
        <ul className="space-y-1">
          {sub.items.slice(0, 6).map((item) => (
            <li
              key={item.id}
              className="flex items-baseline gap-2 text-xs text-muted-foreground"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border" />
              <span className="text-foreground/70">{item.label}</span>
              {item.note && (
                <span className="truncate opacity-60">— {item.note}</span>
              )}
            </li>
          ))}
          {sub.items.length > 6 && (
            <li className="pl-3 text-[11px] text-muted-foreground/60">
              +{sub.items.length - 6} więcej
            </li>
          )}
        </ul>
      ) : (
        <p className="pl-3 text-[11px] text-muted-foreground/50">—</p>
      )}
    </div>
  );
}
