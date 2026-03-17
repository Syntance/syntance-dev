import { redirect } from "next/navigation";
import { getCurrentProject } from "@/lib/get-project";
import { StatusBar } from "@/components/status-bar";
import { ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  design: "Projektowanie",
  development: "Development",
  qa: "Testowanie",
  review: "Review",
  live: "Live",
};

export default async function DashboardPage() {
  const project = await getCurrentProject();
  if (!project) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Witaj{project.clientName ? `, ${project.clientName}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Aktualny etap:{" "}
          <span className="font-medium text-accent-light">
            {STATUS_LABELS[project.status] || project.status}
          </span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-6 text-sm font-medium text-muted-foreground">
          Postęp projektu
        </h2>
        <StatusBar currentStatus={project.status} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Live Preview
          </h2>
          <a
            href={project.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent-light transition-colors hover:text-accent-foreground"
          >
            Otwórz w nowej karcie
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-b-xl">
          <iframe
            src={project.previewUrl}
            className="h-full w-full border-0"
            title="Live preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
}
