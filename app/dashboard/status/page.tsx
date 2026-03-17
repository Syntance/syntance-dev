import { redirect } from "next/navigation";
import { getCurrentProject } from "@/lib/get-project";
import { StatusBar } from "@/components/status-bar";
import { Calendar, Clock } from "lucide-react";

const PROJECT_STATUSES = ["design", "development", "qa", "review", "live"];

const STATUS_LABELS: Record<string, string> = {
  design: "Projektowanie",
  development: "Development",
  qa: "Testowanie",
  review: "Review",
  live: "Live",
};

export default async function StatusPage() {
  const project = await getCurrentProject();
  if (!project) redirect("/login");

  const currentIndex = PROJECT_STATUSES.indexOf(project.status);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Status projektu</h1>
        <p className="text-sm text-muted-foreground">
          Szczegółowy widok postępu realizacji
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8">
        <StatusBar currentStatus={project.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Clock className="h-5 w-5 text-accent-light" />
          </div>
          <p className="text-sm text-muted-foreground">Aktualny etap</p>
          <p className="mt-1 text-lg font-semibold">
            {STATUS_LABELS[project.status] || project.status}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Calendar className="h-5 w-5 text-accent-light" />
          </div>
          <p className="text-sm text-muted-foreground">Rozpoczęto</p>
          <p className="mt-1 text-lg font-semibold">
            {new Date(project._createdAt).toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <div className="text-lg font-bold text-success">
              {Math.round(
                ((currentIndex + 1) / PROJECT_STATUSES.length) * 100
              )}
              %
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Postęp</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent-light transition-all"
              style={{
                width: `${((currentIndex + 1) / PROJECT_STATUSES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Etapy realizacji
          </h2>
        </div>
        <div className="divide-y divide-border">
          {PROJECT_STATUSES.map((status, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={status} className="flex items-center gap-4 px-6 py-4">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isCompleted
                      ? "bg-accent-light"
                      : isCurrent
                        ? "bg-accent-light animate-pulse"
                        : "bg-border"
                  }`}
                />
                <span
                  className={`text-sm ${
                    isCurrent
                      ? "font-medium text-foreground"
                      : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-light">
                    W trakcie
                  </span>
                )}
                {isCompleted && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Ukończono
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
