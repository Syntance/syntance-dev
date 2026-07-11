import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { getMessageMatrix } from "@/lib/strategy-hub/message-matrix";
import { MessageMatrixSection } from "@/components/strategy-hub/message-matrix";
import { SalesClient } from "../../sales/sales-client";

export const metadata = { title: "Copy i przekaz" };

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

  const matrix = await getMessageMatrix(id);

  return (
    <div className="w-full min-w-0 space-y-4">
      <MessageMatrixSection projectId={id} matrix={matrix} />
      <SalesClient projectId={id} projectName={project.name} />
    </div>
  );
}
