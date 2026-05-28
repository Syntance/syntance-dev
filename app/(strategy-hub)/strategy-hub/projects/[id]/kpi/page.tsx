import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { KpiClient } from "./kpi-client";

export const metadata = { title: "KPI" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KpiPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <KpiClient projectId={id} projectName={project.name} />;
}
