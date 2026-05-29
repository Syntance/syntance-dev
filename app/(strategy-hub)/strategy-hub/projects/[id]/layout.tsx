import { notFound } from "next/navigation";
import { requireStrategyHubAccess, getProjectForAdmin } from "@/lib/strategy-hub/context";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params;

  const access = await requireStrategyHubAccess();
  const project = await getProjectForAdmin(id, access.session.email);

  if (!project) notFound();

  return children;
}
