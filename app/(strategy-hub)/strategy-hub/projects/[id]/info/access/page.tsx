import { notFound } from "next/navigation";
import { db } from "@/db";
import { hostingServices, domains, clientResources } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { AdminDashboard } from "../../admin/admin-dashboard";

export const metadata = { title: "Dostępy i hosting" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InfoAccessPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  const [hostingList, domainList, resourceList] = await Promise.all([
    db.select().from(hostingServices).where(eq(hostingServices.projectId, id)),
    db.select().from(domains).where(eq(domains.projectId, id)),
    db
      .select()
      .from(clientResources)
      .where(eq(clientResources.projectId, id))
      .orderBy(asc(clientResources.orderIdx)),
  ]);

  return (
    <AdminDashboard
      projectId={id}
      projectName={project.name}
      hosting={hostingList}
      domains={domainList}
      resources={resourceList}
    />
  );
}
