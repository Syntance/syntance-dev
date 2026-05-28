import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  projects,
  businessStrategy,
  businessProblems,
  objections,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { BusinessStrategyEditorLoader } from "./business-strategy-editor-loader";

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

  const [stratRows, problemRows, objectionRows] = await Promise.all([
    db
      .select()
      .from(businessStrategy)
      .where(eq(businessStrategy.projectId, id))
      .limit(1),
    db
      .select()
      .from(businessProblems)
      .where(
        and(
          eq(businessProblems.projectId, id),
          isNull(businessProblems.deletedAt)
        )
      )
      .orderBy(asc(businessProblems.orderIdx), asc(businessProblems.createdAt)),
    db
      .select()
      .from(objections)
      .where(and(eq(objections.projectId, id), isNull(objections.deletedAt)))
      .orderBy(asc(objections.orderIdx), asc(objections.createdAt)),
  ]);

  const strategy = stratRows[0] ?? {
    projectId: id,
    goalsMd: "",
    uvpMd: "",
    competitorsMd: "",
    objectionsMd: "",
    updatedAt: new Date(),
    updatedBy: null,
  };

  return { project, strategy, problems: problemRows, objections: objectionRows };
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
    <BusinessStrategyEditorLoader
      projectId={id}
      projectName={data.project.name}
      strategy={data.strategy}
      problems={data.problems}
      objections={data.objections}
    />
  );
}
