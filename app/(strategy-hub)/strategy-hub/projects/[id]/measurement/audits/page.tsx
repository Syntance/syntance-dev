import { notFound } from "next/navigation";

import { db } from "@/db";

import { sites } from "@/db/schema";

import { and, eq, isNull } from "drizzle-orm";

import { getProjectById } from "@/lib/strategy-hub/context";

import { WebsiteRelations } from "../../website/website-relations";



export const metadata = { title: "Audyty" };



interface Props {

  params: Promise<{ id: string }>;

}



async function resolvePrimarySiteId(projectId: string): Promise<string | null> {

  const row = await db

    .select({ id: sites.id })

    .from(sites)

    .where(

      and(

        eq(sites.projectId, projectId),

        eq(sites.isPrimary, true),

        isNull(sites.deletedAt)

      )

    )

    .limit(1);

  if (row[0]) return row[0].id;



  const fallback = await db

    .select({ id: sites.id })

    .from(sites)

    .where(and(eq(sites.projectId, projectId), isNull(sites.deletedAt)))

    .limit(1);

  return fallback[0]?.id ?? null;

}



export default async function AuditsPage({ params }: Props) {

  const { id } = await params;



  const project = await getProjectById(id);

  if (!project) notFound();



  const siteId = await resolvePrimarySiteId(id);

  if (!siteId) notFound();



  return (

    <WebsiteRelations

      projectId={id}

      siteId={siteId}

      pages={[]}

      initialTab="audits"

      visibleTabs={["audits"]}

    />

  );

}

