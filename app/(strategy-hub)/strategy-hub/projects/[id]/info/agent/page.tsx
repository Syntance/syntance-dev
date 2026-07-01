import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { AgentPanel } from "@/components/strategy-hub/agent-panel";

export const metadata = { title: "Agent AI" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="w-full min-w-0 space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-xl font-semibold tracking-tight">Agent AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          4 tryby (Audyt / Research / Poprawa / Monitoring) generują propozycje w kolejce —
          żadna zmiana nie zapisuje się do projektu bez Twojej akceptacji.
        </p>
      </header>

      <AgentPanel projectId={id} />
    </div>
  );
}
