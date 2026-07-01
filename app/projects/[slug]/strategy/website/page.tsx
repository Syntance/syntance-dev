import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  pages,
  seoKeywords,
  techStack,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { Globe, Search, Layers, ExternalLink, Hammer } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";
import { WebsiteClientView } from "./website-client-view";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getWebsiteData(slug: string) {
  const rows = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);

  if (!rows[0]) return null;

  const projectId = rows[0].id;
  const vis = await getProjectVisibility(projectId);
  const moduleVis: VisibilityStatus = moduleStatus(vis, "website");
  const [pageList, seoList, techList] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.priority)),
    db
      .select()
      .from(seoKeywords)
      .where(
        and(eq(seoKeywords.projectId, projectId), isNull(seoKeywords.deletedAt))
      )
      .orderBy(asc(seoKeywords.priority)),
    db
      .select()
      .from(techStack)
      .where(and(eq(techStack.projectId, projectId), isNull(techStack.deletedAt))),
  ]);

  return { projectId, moduleVis, pageList, seoList, techList };
}

export default async function ClientWebsitePage({ params }: Props) {
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

  const data = await getWebsiteData(slug);
  if (data) trackVisit(data.projectId, "website");

  if (data?.moduleVis === "hidden") notFound();

  const hasContent =
    data &&
    (data.pageList.length > 0 ||
      data.seoList.length > 0 ||
      data.techList.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Strona</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Struktura strony, frazy SEO i stack technologiczny.
        </p>
      </div>

      {data?.moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pracujemy nad nią — wróć wkrótce.
          </p>
        </div>
      ) : !hasContent ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Globe className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Dane strony są opracowywane.
          </p>
        </div>
      ) : (
        <>
          {data!.pageList.length > 0 && (
            <WebsiteClientView
              projectId={data!.projectId}
              pages={data!.pageList.map((p) => ({
                id: p.id,
                name: p.name,
                urlPath: p.urlPath,
                status: p.status,
              }))}
            />
          )}

          {data!.seoList.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <h2 className="font-medium text-sm">
                  Frazy SEO ({data!.seoList.length})
                </h2>
              </div>
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {data!.seoList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm truncate">{s.phrase}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.intent && <span>{s.intent}</span>}
                        {s.funnelStage && <span> · {s.funnelStage}</span>}
                      </div>
                    </div>
                    {s.volume != null && (
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        vol {s.volume}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {data!.techList.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <h2 className="font-medium text-sm">
                  Stack ({data!.techList.length})
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data!.techList.map((t) => (
                  <a
                    key={t.id}
                    href={t.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      {t.url && (
                        <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    {t.category && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.category}
                      </div>
                    )}
                    {t.description && (
                      <div className="text-xs text-muted-foreground/80 mt-2 line-clamp-2">
                        {t.description}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
