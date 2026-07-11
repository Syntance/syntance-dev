import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { FunnelWorkspace } from "@/components/strategy-hub/funnel-workspace";

export const metadata = { title: "Lejek marketingowy" };

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

  return <FunnelWorkspace projectId={id} projectName={project.name} />;
}
