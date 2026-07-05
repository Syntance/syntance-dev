"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionOverlay } from "@/components/strategy-hub/strategy-map/decision-overlay";
import {
  ENTITY_TYPE_META,
  RELATION_TYPES,
  type RelationTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import type {
  ConstellationLink,
  ConstellationNode,
} from "@/lib/strategy-hub/constellation-types";
import { parseEntityNodeId } from "@/lib/strategy-hub/constellation-types";

interface EntityPanelProps {
  projectId: string;
  node: ConstellationNode;
  links: ConstellationLink[];
  allNodes: ConstellationNode[];
  mode: "editor" | "client";
  open: boolean;
  onClose: () => void;
  onRelationAdded: () => void;
  /** Przejście do sceny grafu tego elementu (wpływa/wynika). */
  onShowScene?: () => void;
}

export function EntityPanel({
  projectId,
  node,
  links,
  allNodes,
  mode,
  open,
  onClose,
  onRelationAdded,
  onShowScene,
}: EntityPanelProps) {
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<RelationTypeKey>("powiazany_z");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseEntityNodeId(node.id);
  const entityType = node.entityType ?? parsed?.type;
  const entityId = parsed?.id;

  const incoming = useMemo(
    () => links.filter((l) => l.kind === "cross" && l.targetId === node.id),
    [links, node.id]
  );
  const outgoing = useMemo(
    () => links.filter((l) => l.kind === "cross" && l.sourceId === node.id),
    [links, node.id]
  );

  const targetOptions = useMemo(
    () =>
      allNodes.filter(
        (n) => n.kind === "entity" && n.id !== node.id && n.entityType
      ),
    [allNodes, node.id]
  );

  const labelFor = useCallback(
    (id: string) => allNodes.find((n) => n.id === id)?.label ?? id,
    [allNodes]
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (!open && prevOpen) {
    setPrevOpen(open);
    setError(null);
    setTargetId("");
  } else if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const addRelation = async () => {
    if (!entityType || !entityId || !targetId) return;
    const targetParsed = parseEntityNodeId(targetId);
    if (!targetParsed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/strategy-hub/projects/${projectId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type: entityType, id: entityId },
          target: { type: targetParsed.type, id: targetParsed.id },
          relationType,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Nie udało się dodać relacji");
        return;
      }
      onRelationAdded();
      setTargetId("");
    } finally {
      setSaving(false);
    }
  };

  if (!open || node.kind !== "entity" || !entityType || !entityId) return null;

  const typeLabel = ENTITY_TYPE_META[entityType]?.label ?? entityType;

  return (
    <>
      <aside
        className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-border/60 bg-card/95 shadow-2xl backdrop-blur-md"
        aria-label="Panel encji"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </p>
            <h2 className="text-sm font-semibold leading-snug">{node.label}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Zamknij panel"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {(incoming.length > 0 || outgoing.length > 0) && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Relacje</h3>
              {incoming.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {incoming.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-md bg-muted/40 px-2 py-1.5"
                    >
                      <span className="text-muted-foreground">← </span>
                      {labelFor(l.sourceId)}
                      {l.relationLabel && (
                        <span className="text-muted-foreground"> · {l.relationLabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {outgoing.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {outgoing.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-md bg-muted/40 px-2 py-1.5"
                    >
                      <span className="text-muted-foreground">→ </span>
                      {labelFor(l.targetId)}
                      {l.relationLabel && (
                        <span className="text-muted-foreground"> · {l.relationLabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {mode === "editor" && (
            <section className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <h3 className="text-xs font-medium">Dodaj relację</h3>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Encja docelowa"
              >
                <option value="">Wybierz encję…</option>
                {targetOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as RelationTypeKey)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Typ relacji"
              >
                {(Object.keys(RELATION_TYPES) as RelationTypeKey[]).map((key) => (
                  <option key={key} value={key}>
                    {RELATION_TYPES[key].label}
                  </option>
                ))}
              </select>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5"
                disabled={!targetId || saving}
                onClick={() => void addRelation()}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Dodaj relację
              </Button>
            </section>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {onShowScene && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={onShowScene}
            >
              Graf zależności
            </Button>
          )}
          {mode === "editor" && node.href && (
            <Link
              href={node.href}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand hover:bg-brand/20"
            >
              Otwórz w edytorze
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setDecisionsOpen(true)}
          >
            Pokaż decyzje
          </Button>
        </div>
      </aside>

      <DecisionOverlay
        projectId={projectId}
        entityType={entityType}
        entityId={entityId}
        entityLabel={node.label}
        open={decisionsOpen}
        onClose={() => setDecisionsOpen(false)}
      />
    </>
  );
}
