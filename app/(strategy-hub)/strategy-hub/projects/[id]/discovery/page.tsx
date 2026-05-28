import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { DiscoveryClient } from "./discovery-client";

export const metadata = { title: "Discovery" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DiscoveryPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <DiscoveryClient projectId={id} projectName={project.name} />;
}
