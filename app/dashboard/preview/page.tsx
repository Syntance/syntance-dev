import { redirect } from "next/navigation";
import { getCurrentProject } from "@/lib/get-project";
import { ExternalLink, Maximize2 } from "lucide-react";

export default async function PreviewPage() {
  const project = await getCurrentProject();
  if (!project) redirect("/login");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Live Preview</h1>
          <p className="text-sm text-muted-foreground">
            Podgląd aktualnego stanu Twojej strony
          </p>
        </div>
        <a
          href={project.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          Pełny ekran
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive/50" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
            <div className="h-3 w-3 rounded-full bg-success/50" />
          </div>
          <div className="flex-1 rounded-md bg-background px-3 py-1 text-center text-xs text-muted-foreground">
            {project.previewUrl}
          </div>
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <div className="relative" style={{ height: "calc(100vh - 240px)" }}>
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
