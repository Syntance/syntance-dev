import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { pages, seoKeywords, sites, techStack } from "@/db/schema";
import { eq, isNull, and, or, desc, asc } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { SiteSwitcher } from "@/components/strategy-hub/site-switcher";
import { WebsiteDashboard } from "../../website/website-dashboard";
import { WebsiteRelations } from "../../website/website-relations";

export const metadata = { title: "Strony WWW" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ site?: string }>;
}

export default async function SitesPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { site: siteParam } = await searchParams;

  const project = await getProjectById(id);
  if (!project) notFound();

  const siteList = await db
    .select()
    .from(sites)
    .where(and(eq(sites.projectId, id), isNull(sites.deletedAt)))
    .orderBy(desc(sites.isPrimary), asc(sites.name));

  if (siteList.length === 0) notFound();

  const primarySite = siteList.find((s) => s.isPrimary) ?? siteList[0];
  const activeSite =
    siteList.find((s) => s.id === siteParam) ?? primarySite;

  const { id: activeSiteId, isPrimary } = activeSite;
  const pageSiteFilter = isPrimary
    ? or(eq(pages.siteId, activeSiteId), isNull(pages.siteId))
    : eq(pages.siteId, activeSiteId);
  const seoSiteFilter = isPrimary
    ? or(eq(seoKeywords.siteId, activeSiteId), isNull(seoKeywords.siteId))
    : eq(seoKeywords.siteId, activeSiteId);

  const [pageList, seoList, techList] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(
        and(eq(pages.projectId, id), isNull(pages.deletedAt), pageSiteFilter)
      ),
    db
      .select()
      .from(seoKeywords)
      .where(
        and(eq(seoKeywords.projectId, id), isNull(seoKeywords.deletedAt), seoSiteFilter)
      ),
    db
      .select()
      .from(techStack)
      .where(and(eq(techStack.projectId, id), isNull(techStack.deletedAt))),
  ]);

  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <div className="h-10 rounded-md border border-border bg-muted/30 animate-pulse" />
        }
      >
        <SiteSwitcher
          projectId={id}
          sites={siteList.map((s) => ({
            id: s.id,
            name: s.name,
            domain: s.domain,
            isPrimary: s.isPrimary,
          }))}
          activeSiteId={activeSite.id}
        />
      </Suspense>

      <WebsiteDashboard
        projectId={id}
        projectName={project.name}
        siteId={activeSite.id}
        siteName={activeSite.name}
        pages={pageList}
        seoKeywords={seoList}
        techStack={techList}
      />
      <WebsiteRelations
        projectId={id}
        siteId={activeSite.id}
        pages={pageList.map((p) => ({
          id: p.id,
          name: p.name,
          urlPath: p.urlPath,
        }))}
      />
    </div>
  );
}
