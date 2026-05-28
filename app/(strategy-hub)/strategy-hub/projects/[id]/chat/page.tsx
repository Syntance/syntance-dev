import { notFound } from "next/navigation";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { ChatPageLoader } from "./chat-page-loader";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  const name = rows[0]?.name ?? "Projekt";
  return { title: `AI Chat · ${name}` };
}

export default async function ChatPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) notFound();

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col">
      <ChatPageLoader projectId={project.id} projectName={project.name} />
    </div>
  );
}
