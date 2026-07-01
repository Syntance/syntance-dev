"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { ChannelHeatmapLoader } from "@/components/strategy-hub/channel-heatmap";

const FunnelBoard = dynamic(
  () => import("@/components/strategy-hub/funnel-board").then((m) => m.FunnelBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-border text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie planszy lejka…
      </div>
    ),
  }
);

interface Props {
  projectId: string;
}

export function ClientFunnelView({ projectId }: Props) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Funnel Flow Builder</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Elementy lejka per segment i faza TOFU / MOFU / BOFU / Retencja wraz z
            powiązaniami kanałów.
          </p>
        </div>
        <FunnelBoard projectId={projectId} mode="client" />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Channel Heatmap — kanał × segment × etap
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Intensywność aktywności kanałów w macierzy etapów lejka.
          </p>
        </div>
        <ChannelHeatmapLoader projectId={projectId} mode="client" />
      </section>
    </div>
  );
}
