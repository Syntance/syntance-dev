import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import { projects as dbProjects, clientResources } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { Link2, ExternalLink } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ClientLinksPage({ params }: Props) {
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

  const projectRow = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);

  let resources: Array<{
    id: string;
    label: string;
    url: string;
    category: string | null;
    icon: string | null;
  }> = [];

  if (projectRow[0]) {
    trackVisit(projectRow[0].id, "links");
    resources = await db
      .select({
        id: clientResources.id,
        label: clientResources.label,
        url: clientResources.url,
        category: clientResources.category,
        icon: clientResources.icon,
      })
      .from(clientResources)
      .where(eq(clientResources.projectId, projectRow[0].id))
      .orderBy(asc(clientResources.orderIdx));
  }

  const grouped = resources.reduce<Record<string, typeof resources>>(
    (acc, r) => {
      const key = r.category ?? "Inne";
      (acc[key] ||= []).push(r);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">
            Linki i zasoby
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Wszystko, do czego mamy dostęp w jednym miejscu.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Link2 className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Brak udostępnionych linków.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              {category}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((r) => (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-colors"
                >
                  <span className="size-9 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
                    {r.icon ?? "🔗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{r.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.url}
                    </div>
                  </div>
                  <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
