import { notFound } from "next/navigation";
import { db } from "@/db";
import { pages, seoKeywords, techStack } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { WebsiteDashboard } from "./website-dashboard";

export const metadata = { title: "Strona" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WebsitePage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  const [pageList, seoList, techList] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, id), isNull(pages.deletedAt))),
    db
      .select()
      .from(seoKeywords)
      .where(
        and(eq(seoKeywords.projectId, id), isNull(seoKeywords.deletedAt))
      ),
    db
      .select()
      .from(techStack)
      .where(and(eq(techStack.projectId, id), isNull(techStack.deletedAt))),
  ]);

  return (
    <WebsiteDashboard
      projectId={id}
      projectName={project.name}
      pages={pageList}
      seoKeywords={seoList}
      techStack={techList}
    />
  );
}
