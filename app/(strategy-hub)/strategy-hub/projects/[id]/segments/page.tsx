import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { SegmentsEditor } from "./segments-editor";

export const metadata = { title: "Segmenty" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SegmentsPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <SegmentsEditor projectId={id} projectName={project.name} />;
}
