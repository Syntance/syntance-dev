import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { BrandEditor } from "../../brand/brand-editor";

export const metadata = { title: "Marka" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BrandPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }

  if (!project) notFound();

  return <BrandEditor projectId={id} projectName={project.name} />;
}
