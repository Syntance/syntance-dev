import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { ExportPanel } from "@/components/strategy-hub/export-panel";

export const metadata = { title: "Eksporty" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExportsPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="w-full min-w-0 space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-xl font-semibold tracking-tight">Eksporty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raport strategii do pobrania lub wysyłki mailem — JSON, Markdown, DOCX, PNG/SVG map.
        </p>
      </header>

      <ExportPanel projectId={id} />
    </div>
  );
}
