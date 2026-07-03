"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import { RelationPicker } from "@/components/strategy-hub/relation-picker";
import { Button } from "@/components/ui/button";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Nazwa", type: "text", primary: true },
  {
    key: "type",
    label: "Typ",
    type: "select",
    badge: true,
    options: [
      { value: "product", label: "Produkt" },
      { value: "service", label: "Usługa" },
      { value: "package", label: "Pakiet" },
    ],
  },
  { key: "uvpMd", label: "UVP", type: "textarea" },
  { key: "pricingMd", label: "Cennik (markdown)", type: "textarea" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Aktywna" },
      { value: "draft", label: "Szkic" },
      { value: "archived", label: "Archiwum" },
    ],
  },
];

interface OfferRow {
  id: string;
  name: string;
}

export function OffersClient({ projectId }: { projectId: string }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadOffers = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/offers`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        setOffers((data.items ?? []).map((o: OfferRow) => ({ id: o.id, name: o.name })));
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers, reloadKey]);

  const loadSegments = useCallback(
    async (offerId: string) => {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/offers/${offerId}/segments`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { segmentIds: string[] };
      setSegmentIds(data.segmentIds ?? []);
    },
    [projectId]
  );

  useEffect(() => {
    if (selectedId) void loadSegments(selectedId);
    else setSegmentIds([]);
  }, [selectedId, loadSegments]);

  async function saveSegments() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/offers/${selectedId}/segments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segmentIds }),
        }
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EntityCrud
        projectId={projectId}
        entity="offers"
        fields={FIELDS}
        addLabel="Dodaj ofertę"
        emptyHint="Brak ofert."
        onMutate={() => setReloadKey((k) => k + 1)}
      />

      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Segmenty docelowe oferty</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Przypisz oferty do segmentów — relacja widoczna jako value proposition per grupa.
          </p>
        </div>

        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
        >
          <option value="">— wybierz ofertę —</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        {selectedId && (
          <>
            <RelationPicker
              projectId={projectId}
              entityType="segment"
              cardinality="multi"
              value={segmentIds}
              onChange={(v) => setSegmentIds((v as string[]) ?? [])}
              label="Segmenty (multi)"
              placeholder="+ Przypisz segment"
              className="w-full"
            />
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void saveSegments()}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Zapisz segmenty"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
