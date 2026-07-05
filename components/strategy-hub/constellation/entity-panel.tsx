"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthRing } from "@/components/strategy-hub/health-ring";
import { DecisionOverlay } from "@/components/strategy-hub/strategy-map/decision-overlay";
import { PANEL_SLIDE } from "@/components/strategy-hub/konst-animation";
import { KONST } from "./constellation-theme";
import {
  ENTITY_TYPE_META,
  RELATION_TYPES,
  type RelationTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import type {
  ConstellationLink,
  ConstellationNode,
  CoreSingletons,
} from "@/lib/strategy-hub/constellation-types";
import {
  AREA_META,
  parseEntityNodeId,
} from "@/lib/strategy-hub/constellation-types";
import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import type { SummaryField } from "@/lib/strategy-hub/constellation-entity-summary";

interface EntityPanelProps {
  projectId: string;
  node: ConstellationNode;
  links: ConstellationLink[];
  allNodes: ConstellationNode[];
  upstream: ConstellationNode[];
  downstream: ConstellationNode[];
  health: number;
  singletons?: CoreSingletons;
  mode: "editor" | "client";
  open: boolean;
  onClose: () => void;
  onRelationAdded: () => void;
  onShowScene?: () => void;
  onShowThread?: () => void;
  onEnterArea?: () => void;
  onNodeFocus?: (nodeId: string) => void;
}

const STATUS_LABEL: Record<
  NonNullable<ConstellationNode["status"]>,
  string
> = {
  ready: "Gotowe",
  in_progress: "W toku",
  empty: "Puste",
  review: "Do przeglądu",
};

function parseAreaNodeId(nodeId: string): StrategyArea | null {
  if (!nodeId.startsWith("area:")) return null;
  const area = nodeId.slice(5) as StrategyArea;
  return area in AREA_META ? area : null;
}

function clipMd(text: string | null | undefined, max = 480): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function WingList({
  title,
  nodes,
  tone,
  onNodeFocus,
}: {
  title: string;
  nodes: ConstellationNode[];
  tone: "up" | "down";
  onNodeFocus?: (nodeId: string) => void;
}) {
  if (nodes.length === 0) return null;
  const dotColor = tone === "up" ? KONST.upDot : KONST.downDot;
  const textColor = tone === "up" ? KONST.upText : KONST.downText;

  return (
    <section className="space-y-2">
      <h3
        className="text-[10px] font-medium uppercase tracking-[0.16em]"
        style={{ color: KONST.muted }}
      >
        {title}
      </h3>
      <ul className="space-y-1">
        {nodes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onNodeFocus?.(n.id)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/40"
              style={{ color: textColor }}
            >
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
                aria-hidden
              />
              <span className="leading-snug">{n.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntitySummarySection({
  projectId,
  entityType,
  entityId,
}: {
  projectId: string;
  entityType: NonNullable<ConstellationNode["entityType"]>;
  entityId: string;
}) {
  const [fields, setFields] = useState<SummaryField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/strategy-hub/projects/${projectId}/constellation/entity?type=${encodeURIComponent(entityType)}&id=${encodeURIComponent(entityId)}`
    )
      .then(async (res) => {
        if (!res.ok) return { fields: [] as SummaryField[] };
        return res.json() as Promise<{ fields: SummaryField[] }>;
      })
      .then((body) => {
        if (!cancelled) setFields(body.fields ?? []);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, entityType, entityId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: KONST.muted }}>
        <Loader2 className="size-3.5 animate-spin" />
        Ładowanie szczegółów…
      </div>
    );
  }

  if (fields.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3
        className="text-[10px] font-medium uppercase tracking-[0.16em]"
        style={{ color: KONST.muted }}
      >
        Szczegóły
      </h3>
      <dl className="space-y-2.5">
        {fields.map((f) => (
          <div key={f.label} className="space-y-0.5">
            <dt
              className="text-[10px] uppercase tracking-wide"
              style={{ color: KONST.muted }}
            >
              {f.label}
            </dt>
            <dd
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{ color: KONST.label }}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EntityPanel({
  projectId,
  node,
  links,
  allNodes,
  upstream,
  downstream,
  health,
  singletons,
  mode,
  open,
  onClose,
  onRelationAdded,
  onShowScene,
  onShowThread,
  onEnterArea,
  onNodeFocus,
}: EntityPanelProps) {
  const reducedMotion = useReducedMotion();
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<RelationTypeKey>("powiazany_z");
  const [rationaleMd, setRationaleMd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseEntityNodeId(node.id);
  const entityType = node.entityType ?? parsed?.type;
  const entityId = parsed?.id;
  const areaKey = node.kind === "area" ? parseAreaNodeId(node.id) : null;

  const accentColor =
    node.kind === "core"
      ? KONST.spark
      : node.kind === "area" && areaKey
        ? AREA_META[areaKey].color
        : entityType
          ? (ENTITY_TYPE_META[entityType]?.color ?? node.color)
          : node.color;

  const kindLabel =
    node.kind === "core"
      ? "Rdzeń strategii"
      : node.kind === "area" && areaKey
        ? `Obszar · ${AREA_META[areaKey].label}`
        : entityType
          ? (ENTITY_TYPE_META[entityType]?.label ?? entityType)
          : "Element";

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
    setRationaleMd("");
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
          rationaleMd: rationaleMd.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Nie udało się dodać relacji");
        return;
      }
      onRelationAdded();
      setTargetId("");
      setRationaleMd("");
    } finally {
      setSaving(false);
    }
  };

  const uvp = clipMd(singletons?.uvpMd);
  const positioning = clipMd(singletons?.positioningMd);

  const panelMotion = reducedMotion
    ? { initial: false as const, animate: { x: 0 }, exit: { x: 0 } }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
        transition: PANEL_SLIDE,
      };

  return (
    <motion.aside
      layout
      data-testid="constellation-info-panel"
      {...panelMotion}
      className="relative z-30 flex h-full w-80 shrink-0 flex-col shadow-2xl"
            style={{
              width: 320,
              backgroundColor: KONST.chromeBg,
              borderLeft: `0.5px solid ${KONST.chromeBorder}`,
              backdropFilter: "blur(8px)",
            }}
            aria-label={`Panel: ${node.label}`}
          >
            <div
              className="h-0.5 shrink-0"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />

            <div
              className="flex items-start justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: KONST.chromeBorder }}
            >
              <div className="min-w-0">
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.16em]"
                  style={{ color: KONST.muted }}
                >
                  {kindLabel}
                </p>
                <h2
                  className="truncate text-sm font-semibold leading-snug"
                  style={{ color: KONST.display }}
                >
                  {node.label}
                </h2>
                {(node.status || node.score != null) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {node.status && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.06)",
                          color: node.status === "review" ? KONST.review : KONST.label,
                        }}
                      >
                        {STATUS_LABEL[node.status]}
                      </span>
                    )}
                    {node.score != null && (
                      <span
                        className="text-[10px] tabular-nums"
                        style={{ color: KONST.muted }}
                      >
                        {node.score}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij panel"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
                style={{ color: KONST.label }}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {node.kind === "core" && (
                <>
                  <section className="space-y-3">
                    <h3
                      className="text-[10px] font-medium uppercase tracking-[0.16em]"
                      style={{ color: KONST.muted }}
                    >
                      Kondycja strategii
                    </h3>
                    <div className="flex items-center gap-4">
                      <HealthRing score={health} />
                      <div>
                        <p
                          className="text-2xl font-semibold tabular-nums"
                          style={{ color: KONST.display }}
                        >
                          {health}%
                        </p>
                        <p className="text-xs" style={{ color: KONST.muted }}>
                          Agregat modułów strategii
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3
                      className="text-[10px] font-medium uppercase tracking-[0.16em]"
                      style={{ color: KONST.muted }}
                    >
                      UVP
                    </h3>
                    <p
                      className="text-sm whitespace-pre-wrap"
                      style={{ color: uvp ? KONST.label : KONST.muted }}
                    >
                      {uvp ?? "Brak głównego UVP."}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3
                      className="text-[10px] font-medium uppercase tracking-[0.16em]"
                      style={{ color: KONST.muted }}
                    >
                      Pozycjonowanie
                    </h3>
                    <p
                      className="text-sm whitespace-pre-wrap"
                      style={{ color: positioning ? KONST.label : KONST.muted }}
                    >
                      {positioning ?? "Brak stwierdzenia pozycjonowania."}
                    </p>
                  </section>
                </>
              )}

              {node.kind === "area" && areaKey && (
                <section className="space-y-3">
                  <dl className="space-y-2 text-xs">
                    {node.childCount != null && (
                      <div className="flex justify-between gap-3">
                        <dt style={{ color: KONST.muted }}>Elementy</dt>
                        <dd style={{ color: KONST.label }}>{node.childCount}</dd>
                      </div>
                    )}
                    {node.score != null && (
                      <div className="flex justify-between gap-3">
                        <dt style={{ color: KONST.muted }}>Kompletność</dt>
                        <dd className="tabular-nums" style={{ color: KONST.label }}>
                          {node.score}%
                        </dd>
                      </div>
                    )}
                  </dl>
                  {onEnterArea && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full text-xs"
                      onClick={onEnterArea}
                    >
                      Wejdź do obszaru
                    </Button>
                  )}
                </section>
              )}

              {node.kind === "entity" && entityType && entityId && (
                <>
                  <EntitySummarySection
                    key={`${entityType}:${entityId}`}
                    projectId={projectId}
                    entityType={entityType}
                    entityId={entityId}
                  />

                  {(upstream.length > 0 || downstream.length > 0) && (
                    <div className="space-y-4">
                      <WingList
                        title="Wpływa na"
                        nodes={upstream}
                        tone="up"
                        onNodeFocus={onNodeFocus}
                      />
                      <WingList
                        title="Wynika z"
                        nodes={downstream}
                        tone="down"
                        onNodeFocus={onNodeFocus}
                      />
                    </div>
                  )}

                  {(incoming.length > 0 || outgoing.length > 0) && (
                    <section className="space-y-2">
                      <h3
                        className="text-[10px] font-medium uppercase tracking-[0.16em]"
                        style={{ color: KONST.muted }}
                      >
                        Relacje
                      </h3>
                      {incoming.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {incoming.map((l) => (
                            <li
                              key={l.id}
                              className="rounded-md px-2 py-1.5"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.04)",
                                color: KONST.label,
                              }}
                            >
                              <span style={{ color: KONST.muted }}>← </span>
                              {labelFor(l.sourceId)}
                              {l.relationLabel && (
                                <span style={{ color: KONST.muted }}>
                                  {" "}
                                  · {l.relationLabel}
                                </span>
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
                              className="rounded-md px-2 py-1.5"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.04)",
                                color: KONST.label,
                              }}
                            >
                              <span style={{ color: KONST.muted }}>→ </span>
                              {labelFor(l.targetId)}
                              {l.relationLabel && (
                                <span style={{ color: KONST.muted }}>
                                  {" "}
                                  · {l.relationLabel}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

                  {mode === "editor" && (
                    <section
                      className="space-y-2 rounded-xl border border-dashed p-3"
                      style={{ borderColor: KONST.chromeBorder }}
                    >
                      <h3
                        className="text-xs font-medium"
                        style={{ color: KONST.label }}
                      >
                        Dodaj relację
                      </h3>
                      <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="w-full rounded-md border px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/40"
                        style={{
                          borderColor: KONST.chromeBorder,
                          backgroundColor: KONST.chrome,
                          color: KONST.label,
                        }}
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
                        onChange={(e) =>
                          setRelationType(e.target.value as RelationTypeKey)
                        }
                        className="w-full rounded-md border px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/40"
                        style={{
                          borderColor: KONST.chromeBorder,
                          backgroundColor: KONST.chrome,
                          color: KONST.label,
                        }}
                        aria-label="Typ relacji"
                      >
                        {(Object.keys(RELATION_TYPES) as RelationTypeKey[]).map(
                          (key) => (
                            <option key={key} value={key}>
                              {RELATION_TYPES[key].label}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="text"
                        value={rationaleMd}
                        onChange={(e) => setRationaleMd(e.target.value)}
                        placeholder="np. COO nie czyta PDF-ów — webinar konwertuje lepiej"
                        className="w-full rounded-md border px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/40"
                        style={{
                          borderColor: KONST.chromeBorder,
                          backgroundColor: KONST.chrome,
                          color: KONST.label,
                        }}
                        aria-label="Dlaczego? (uzasadnienie)"
                      />
                      {error && (
                        <p className="text-xs text-red-400">{error}</p>
                      )}
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
                </>
              )}
            </div>

            {node.kind === "entity" && entityType && entityId && (
              <div
                className="flex flex-wrap gap-2 border-t px-4 py-3"
                style={{ borderColor: KONST.chromeBorder }}
              >
                {onShowScene && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-[#3A342A] bg-transparent text-xs hover:bg-white/[0.04]"
                    style={{ color: KONST.label }}
                    onClick={onShowScene}
                  >
                    Graf zależności
                  </Button>
                )}
                {onShowThread && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-[#3A342A] bg-transparent text-xs hover:bg-white/[0.04]"
                    style={{ color: KONST.label }}
                    onClick={onShowThread}
                  >
                    Pokaż nitkę
                  </Button>
                )}
                {mode === "editor" && node.href && (
                  <Link
                    href={node.href}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.08]"
                    style={{
                      backgroundColor: "rgba(227,174,99,0.12)",
                      color: KONST.spark,
                    }}
                  >
                    Otwórz w edytorze
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-[#3A342A] bg-transparent text-xs hover:bg-white/[0.04]"
                  style={{ color: KONST.label }}
                  onClick={() => setDecisionsOpen(true)}
                >
                  Pokaż decyzje
                </Button>
              </div>
            )}

            {entityType && entityId && (
              <DecisionOverlay
                projectId={projectId}
                entityType={entityType}
                entityId={entityId}
                entityLabel={node.label}
                open={decisionsOpen}
                onClose={() => setDecisionsOpen(false)}
              />
            )}
          </motion.aside>
  );
}
