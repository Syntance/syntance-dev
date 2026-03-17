import { headers } from "next/headers";
import { getClientSession } from "@/lib/auth";
import {
  getProjectBySlug,
  getProjectsByEmail,
  type SanityProject,
} from "@/sanity/queries";

export async function getCurrentProject(): Promise<SanityProject | null> {
  const session = await getClientSession();
  if (!session) return null;

  const headersList = await headers();
  const slug = headersList.get("x-project-slug");

  if (slug) {
    const project = await getProjectBySlug(slug);
    if (project && project.clientEmail === session.email) return project;
  }

  const projects = await getProjectsByEmail(session.email);
  return projects[0] || null;
}
