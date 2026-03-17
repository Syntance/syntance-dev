import { redirect } from "next/navigation";
import { getUserProjectsInfo } from "@/lib/get-project";
import { StatusBar } from "@/components/status-bar";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  design: "Projektowanie",
  development: "Development",
  qa: "Testowanie",
  review: "Review",
  live: "Live",
};

const STATUS_COLORS: Record<string, string> = {
  design: "bg-purple-500",
  development: "bg-blue-500",
  qa: "bg-yellow-500",
  review: "bg-orange-500",
  live: "bg-green-500",
};

export default async function DashboardPage() {
  const { projects, isAdmin, currentProject } = await getUserProjectsInfo();
  if (!currentProject) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Witaj{isAdmin ? ", Admin" : currentProject.clientName ? `, ${currentProject.clientName}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Aktualny etap:{" "}
          <span className="font-medium text-accent-light">
            {STATUS_LABELS[currentProject.status] || currentProject.status}
          </span>
        </p>
      </div>

      {isAdmin && projects.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Wszystkie projekty ({projects.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project.slug}
                href={`https://${project.slug}.syntance.dev/dashboard`}
                className={`flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-background/50 ${
                  project.slug === currentProject.slug
                    ? "border-accent-light bg-accent/10"
                    : "border-border"
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${STATUS_COLORS[project.status] || "bg-gray-500"}`}
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {STATUS_LABELS[project.status] || project.status}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-6 text-sm font-medium text-muted-foreground">
          Postęp projektu
        </h2>
        <StatusBar currentStatus={currentProject.status} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Live Preview
          </h2>
          <a
            href={currentProject.previewUrl}
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
            src={currentProject.previewUrl}
            className="h-full w-full border-0"
            title="Live preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
}
