import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { CampaignsClient } from "@/components/strategy-hub/campaigns-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignsPage({ params }: Props) {
  const { id } = await params;
  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Kampanie i reklamy</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Kampanie promujące elementy lejka — widoczne w grafie wpływu.
        </p>
      </div>
      <CampaignsClient projectId={id} />
    </div>
  );
}
