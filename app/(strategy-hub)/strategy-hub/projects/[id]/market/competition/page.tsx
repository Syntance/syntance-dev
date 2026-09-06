import { notFound } from "next/navigation";
import { assertProjectAccess } from "@/lib/strategy-hub/context";
import { getCompetitionAnalysis } from "@/lib/strategy-hub/competition-analysis";
import { CompetitionAnalysisView } from "@/components/strategy-hub/competition-analysis-view";

export const metadata = { title: "Analiza konkurencji" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompetitionAnalysisPage({ params }: Props) {
  const { id } = await params;

  const auth = await assertProjectAccess(id);
  if (!auth.ok) notFound();

  const data = await getCompetitionAnalysis(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analiza konkurencji</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kto jeszcze gra o tego klienta, w czym jest lepszy, a gdzie ma lukę —
          widok do czytania, edycja zostaje w fundamencie strategii.
        </p>
      </div>
      <CompetitionAnalysisView data={data} projectId={id} />
    </div>
  );
}
