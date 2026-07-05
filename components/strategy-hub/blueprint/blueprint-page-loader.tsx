"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { BlueprintData } from "@/lib/strategy-hub/blueprint-types";
import type { LedgerDecision } from "@/lib/strategy-hub/decisions-ledger";
import { DecisionLedger } from "@/components/strategy-hub/decisions/decision-ledger";

const BlueprintView = dynamic(
  () =>
    import("@/components/strategy-hub/blueprint/blueprint-view").then(
      (m) => m.BlueprintView
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full min-h-[420px] flex-1 items-center justify-center gap-2 text-sm"
        style={{ color: "#8E8672" }}
      >
        <Loader2 className="size-4 animate-spin" /> Ładowanie blueprintu…
      </div>
    ),
  }
);

interface Props {
  projectId: string;
  mode: "editor" | "client";
  initialData: BlueprintData;
  constellationBase: string;
  initialLedger?: LedgerDecision[];
}

export function BlueprintPageLoader({
  projectId,
  mode,
  initialData,
  constellationBase,
  initialLedger = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ledger, setLedger] = useState(initialLedger);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [dimDecision, setDimDecision] = useState<LedgerDecision | null>(null);

  const segmentId =
    searchParams.get("segment") ?? initialData.selected?.id ?? null;

  useEffect(() => {
    if (mode !== "editor" || initialLedger.length > 0) return;
    void fetch(`/api/strategy-hub/projects/${projectId}/decisions-ledger`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => r.json())
      .then((body: { decisions?: LedgerDecision[] }) => {
        setLedger(body.decisions ?? []);
      })
      .catch(() => undefined);
  }, [projectId, mode, initialLedger.length]);

  const dimRefKeys = useMemo(() => {
    if (!dimDecision) return null;
    const keys = new Set<string>();
    for (const c of dimDecision.causes) keys.add(`${c.type}:${c.id}`);
    for (const e of dimDecision.effects) keys.add(`${e.type}:${e.id}`);
    return keys;
  }, [dimDecision]);

  const onShowThread = useCallback(
    (entityType: string, entityId: string) => {
      router.push(
        `${constellationBase}?thread=${encodeURIComponent(`${entityType}:${entityId}`)}`
      );
    },
    [constellationBase, router]
  );

  return (
    <>
      <BlueprintView
        projectId={projectId}
        mode={mode}
        initialData={initialData}
        constellationBase={constellationBase}
        decisionCount={ledger.length}
        dimRefKeys={dimRefKeys}
        onDecisionsClick={
          mode === "editor"
            ? () => {
                setLedgerOpen(true);
              }
            : undefined
        }
      />
      {mode === "editor" && (
        <DecisionLedger
          open={ledgerOpen}
          decisions={ledger}
          selectedId={dimDecision?.id ?? null}
          segmentId={segmentId}
          onClose={() => {
            setLedgerOpen(false);
            setDimDecision(null);
          }}
          onSelect={setDimDecision}
          onShowThread={onShowThread}
        />
      )}
    </>
  );
}
