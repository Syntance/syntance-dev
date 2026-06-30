"use client";

import { useState } from "react";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import { EntityMetaPanel } from "@/components/strategy-hub/entity-meta-panel";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Nazwa", type: "text", primary: true },
  { key: "goal", label: "Cel", type: "textarea" },
  {
    key: "stage",
    label: "Etap lejka",
    type: "select",
    badge: true,
    options: [
      { value: "TOFU", label: "TOFU" },
      { value: "MOFU", label: "MOFU" },
      { value: "BOFU", label: "BOFU" },
      { value: "retention", label: "Retencja" },
    ],
  },
  { key: "budgetPlan", label: "Budżet plan (PLN)", type: "number" },
  { key: "budgetSpent", label: "Wydano (PLN)", type: "number" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "planned", label: "Planowana" },
      { value: "active", label: "Aktywna" },
      { value: "paused", label: "Wstrzymana" },
      { value: "done", label: "Zakończona" },
    ],
  },
];

export function CampaignsClient({ projectId }: { projectId: string }) {
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <EntityCrud
        projectId={projectId}
        entity="campaigns"
        fields={FIELDS}
        addLabel="Dodaj kampanię"
        emptyHint="Brak kampanii — dodaj pierwszą."
        onMutate={() => {}}
      />
      <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
        <label htmlFor="campaign-focus" className="text-xs text-muted-foreground">
          Komentarze / timeline — ID kampanii
        </label>
        <input
          id="campaign-focus"
          type="text"
          placeholder="UUID kampanii"
          value={focusId ?? ""}
          onChange={(e) => setFocusId(e.target.value || null)}
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-xs font-mono"
        />
        {focusId && (
          <EntityMetaPanel
            projectId={projectId}
            entityType="campaign"
            entityId={focusId}
          />
        )}
      </div>
    </div>
  );
}
