import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { FunnelClient } from "./funnel-client";

export const metadata = { title: "Lejek i kanały" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FunnelPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <FunnelClient projectId={id} projectName={project.name} />;
}
