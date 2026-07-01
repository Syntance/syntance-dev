import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { ExternalLink, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PreviewPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }

  if (!project) notFound();

  const previewUrl = project.clientDomain
    ? `https://${project.clientDomain}`
    : project.previewUrl;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="size-4 text-brand" />
          <h1 className="font-semibold text-sm">Podgląd strony</h1>
          <span className="text-xs text-muted-foreground font-mono ml-2">
            {previewUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5 mr-1.5" />
            Otwórz w nowej karcie
          </a>
        </Button>
      </div>

      <div className="flex-1 rounded-xl border border-border overflow-hidden bg-muted/20">
        <iframe
          src={previewUrl}
          className="w-full h-full"
          title={`Podgląd — ${project.name}`}
          loading="lazy"
        />
      </div>
    </div>
  );
}
