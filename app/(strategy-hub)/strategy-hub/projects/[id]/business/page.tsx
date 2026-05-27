import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects, businessStrategy } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { BusinessStrategyEditor } from "./business-strategy-editor";

export const metadata = { title: "Strategia biznesowa" };

interface Props {
  params: Promise<{ id: string }>;
}

async function getData(id: string) {
  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) return null;

  const stratRows = await db
    .select()
    .from(businessStrategy)
    .where(eq(businessStrategy.projectId, id))
    .limit(1);

  const strategy = stratRows[0] ?? {
    projectId: id,
    goalsMd: "",
    uvpMd: "",
    competitorsMd: "",
    objectionsMd: "",
    updatedAt: new Date(),
    updatedBy: null,
  };

  return { project, strategy };
}

export default async function BusinessStrategyPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getData(id);
  } catch {
    data = null;
  }

  if (!data) notFound();

  return (
    <BusinessStrategyEditor
      projectId={id}
      projectName={data.project.name}
      strategy={data.strategy}
    />
  );
}
