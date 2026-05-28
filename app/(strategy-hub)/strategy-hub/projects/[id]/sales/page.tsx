import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { SalesClient } from "./sales-client";

export const metadata = { title: "Sprzedaż i copy" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SalesPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <SalesClient projectId={id} projectName={project.name} />;
}
