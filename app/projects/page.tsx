import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectsForUser } from "@/sanity/queries";
import { SyntanceLogo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { FolderOpen, ExternalLink } from "lucide-react";

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

const STATUSES = ["design", "development", "qa", "review", "live"];

function MiniStatusBar({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUSES.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1">
      {STATUSES.map((status, index) => (
        <div
          key={status}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            index <= currentIndex
              ? STATUS_COLORS[currentStatus] || "bg-accent-light"
              : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default async function ProjectsPage() {
  const session = await getClientSession();
  if (!session) {
    redirect("/login");
  }

  const { projects, isAdmin, client } = await getProjectsForUser(session.email);

  if (!client) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <SyntanceLogo />
            {isAdmin && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-light">
                Admin
              </span>
            )}
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Witaj{client.name ? `, ${client.name}` : ""}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            Wybierz projekt, aby zobaczyć stronę
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Nie masz jeszcze przypisanych projektów.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project._id}
                href={project.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-accent-light hover:bg-card/80"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium ${STATUS_COLORS[project.status]} text-white`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <h2 className="mb-1 text-lg font-semibold">{project.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {project.clientDomain || project.previewUrl.replace(/^https?:\/\//, "")}
                </p>

                {project.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/70">
                    {project.description}
                  </p>
                )}

                <div className="mt-4">
                  <MiniStatusBar currentStatus={project.status} />
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-4">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-xs text-muted-foreground/50">
            Powered by Syntance
          </p>
        </div>
      </footer>
    </div>
  );
}
