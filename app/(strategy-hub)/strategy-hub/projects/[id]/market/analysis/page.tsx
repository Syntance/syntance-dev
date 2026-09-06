import { notFound } from "next/navigation";
import { assertProjectAccess } from "@/lib/strategy-hub/context";
import { getMarketAnalysis } from "@/lib/strategy-hub/market-analysis";
import { MarketAnalysisView } from "@/components/strategy-hub/market-analysis-view";

export const metadata = { title: "Analiza rynku" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketAnalysisPage({ params }: Props) {
  const { id } = await params;

  const auth = await assertProjectAccess(id);
  if (!auth.ok) notFound();

  const data = await getMarketAnalysis(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analiza rynku</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zebrane w jednym miejscu to, co wiemy o rynku i jego segmentach —
          widok do czytania, edycja zostaje w swoich modułach.
        </p>
      </div>
      <MarketAnalysisView data={data} projectId={id} />
    </div>
  );
}
