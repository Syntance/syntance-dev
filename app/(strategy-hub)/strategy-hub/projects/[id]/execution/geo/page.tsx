import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import {
  GeoAssetsClient,
  GeoQueriesClient,
} from "@/components/strategy-hub/geo-client";

export const metadata = { title: "GEO / AEO" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GeoPage({ params }: Props) {
  const { id } = await params;
  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">GEO / AEO</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Assety z checklistą AEO oraz zapytania ze statusem cytowania per silnik AI.
        </p>
      </div>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Assety GEO — checklista AEO</h3>
        <GeoAssetsClient projectId={id} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Zapytania monitorowane — cytowanie w AI</h3>
        <GeoQueriesClient projectId={id} />
      </section>
    </div>
  );
}
