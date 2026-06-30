"use client";

import { useCallback, useEffect, useState } from "react";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import {
  RelationPicker,
  type EntityType,
} from "@/components/strategy-hub/relation-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";

const FIELDS: FieldDef[] = [
  { key: "title", label: "Tytuł", type: "text", primary: true },
  { key: "reasonMd", label: "Przyczyna (markdown)", type: "textarea" },
  { key: "evidenceMd", label: "Dowód / research", type: "textarea" },
  {
    key: "status",
    label: "Status",
    type: "select",
    badge: true,
    options: [
      { value: "active", label: "Aktywna", tone: "success" },
      { value: "revised", label: "Zmieniona", tone: "warning" },
      { value: "withdrawn", label: "Wycofana", tone: "neutral" },
    ],
  },
  {
    key: "authorType",
    label: "Autor",
    type: "select",
    options: [
      { value: "human", label: "Człowiek" },
      { value: "ai", label: "AI" },
    ],
  },
];

/** Typy encji, które można powiązać jako przyczyna/skutek decyzji. */
const LINK_TYPES: { value: EntityType; label: string }[] = [
  { value: "segment", label: "Segment" },
  { value: "funnel_element", label: "Element lejka" },
  { value: "page", label: "Podstrona" },
  { value: "campaign", label: "Kampania" },
  { value: "kpi", label: "KPI" },
  { value: "offer", label: "Oferta" },
];

interface LinkRow {
  entityType: string;
  entityId: string;
  role: "cause" | "effect";
}

interface DecisionRow {
  id: string;
  title: string;
}

interface Props {
  projectId: string;
  mode?: "editor" | "client";
}

export function DecisionsEditor({ projectId, mode = "editor" }: Props) {
  const readOnly = mode === "client";
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Form do dodania powiązania
  const [linkType, setLinkType] = useState<EntityType>("segment");
  const [linkRole, setLinkRole] = useState<"cause" | "effect">("cause");

  const loadDecisions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/decisions`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        setDecisions(
          (data.items ?? []).map((d: DecisionRow) => ({
            id: d.id,
            title: d.title,
          }))
        );
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- celowy fetch listy decyzji
    void loadDecisions();
  }, [loadDecisions, reloadKey]);

  const loadLinks = useCallback(
    async (decisionId: string) => {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/decisions/${decisionId}/links`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { links: LinkRow[] };
      setLinks(
        (data.links ?? []).map((l) => ({
          entityType: l.entityType,
          entityId: l.entityId,
          role: l.role as "cause" | "effect",
        }))
      );
    },
    [projectId]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- celowy fetch powiązań decyzji
    if (selectedId) void loadLinks(selectedId);
    else setLinks([]);
  }, [selectedId, loadLinks]);

  async function saveLinks() {
    if (!selectedId) return;
    setSavingLinks(true);
    try {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/decisions/${selectedId}/links`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links }),
        }
      );
    } finally {
      setSavingLinks(false);
    }
  }

  function addLink(entityId: string | null) {
    if (!entityId) return;
    setLinks((prev) => [
      ...prev.filter(
        (l) =>
          !(
            l.role === linkRole &&
            l.entityType === linkType &&
            l.entityId === entityId
          )
      ),
      { entityType: linkType, entityId, role: linkRole },
    ]);
  }

  function removeLink(target: LinkRow) {
    setLinks((prev) =>
      prev.filter(
        (l) =>
          !(
            l.role === target.role &&
            l.entityType === target.entityType &&
            l.entityId === target.entityId
          )
      )
    );
  }

  const causes = links.filter((l) => l.role === "cause");
  const effects = links.filter((l) => l.role === "effect");

  return (
    <div className="space-y-6">
      <EntityCrud
        projectId={projectId}
        entity="decisions"
        fields={FIELDS}
        addLabel="Dodaj decyzję"
        emptyHint="Rejestruj decyzje strategiczne — uzasadnienia widoczne na mapie firmy."
        onMutate={() => setReloadKey((k) => k + 1)}
      />

      {!readOnly && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Powiązania cause / effect</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Wybierz decyzję i połącz ją z encjami, które ją uzasadniają
              (przyczyna) oraz na które wpływa (skutek). Napędza overlay
              „dlaczego tak?” na mapie firmy.
            </p>
          </div>

          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
          >
            <option value="">— wybierz decyzję —</option>
            {decisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          {selectedId && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Rola</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={linkRole === "cause" ? "default" : "outline"}
                      onClick={() => setLinkRole("cause")}
                    >
                      Przyczyna
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={linkRole === "effect" ? "default" : "outline"}
                      onClick={() => setLinkRole("effect")}
                    >
                      Skutek
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Typ encji</span>
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value as EntityType)}
                    className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <RelationPicker
                    projectId={projectId}
                    entityType={linkType}
                    cardinality="single"
                    value={null}
                    onChange={(id) =>
                      addLink(typeof id === "string" ? id : null)
                    }
                    label={`Dodaj ${linkRole === "cause" ? "przyczynę" : "skutek"}`}
                    placeholder="Wybierz encję…"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <LinkColumn
                  title="Przyczyny (upstream)"
                  rows={causes}
                  onRemove={removeLink}
                />
                <LinkColumn
                  title="Skutki (downstream)"
                  rows={effects}
                  onRemove={removeLink}
                />
              </div>

              <Button
                type="button"
                size="sm"
                disabled={savingLinks}
                onClick={() => void saveLinks()}
              >
                {savingLinks ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Zapisz powiązania"
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LinkColumn({
  title,
  rows,
  onRemove,
}: {
  title: string;
  rows: LinkRow[];
  onRemove: (row: LinkRow) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">Brak powiązań.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((l) => (
            <li key={`${l.entityType}-${l.entityId}`}>
              <Badge variant="secondary" className="gap-1 pr-1 font-mono text-[11px]">
                <span>
                  {l.entityType} / {l.entityId.slice(0, 8)}…
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(l)}
                  aria-label="Usuń powiązanie"
                  className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
