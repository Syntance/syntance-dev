import { headers } from "next/headers";
import { getClientSession } from "@/lib/auth";
import {
  getProjectBySlug,
  getProjectsForUser,
  type SanityProject,
  type SanityClient,
} from "@/sanity/queries";

export async function getCurrentProject(): Promise<SanityProject | null> {
  const session = await getClientSession();
  if (!session) return null;

  const headersList = await headers();
  const slug = headersList.get("x-project-slug");

  const { projects, isAdmin } = await getProjectsForUser(session.email);

  if (slug) {
    const project = await getProjectBySlug(slug);
    if (project) {
      const hasAccess = isAdmin || projects.some((p) => p._id === project._id);
      if (hasAccess) {
        return project;
      }
    }
  }

  return projects[0] || null;
}

export async function getUserProjectsInfo(): Promise<{
  projects: SanityProject[];
  isAdmin: boolean;
  currentProject: SanityProject | null;
  client: SanityClient | null;
}> {
  const session = await getClientSession();
  if (!session) return { projects: [], isAdmin: false, currentProject: null, client: null };

  const headersList = await headers();
  const slug = headersList.get("x-project-slug");

  const { projects, isAdmin, client } = await getProjectsForUser(session.email);

  let currentProject: SanityProject | null = null;

  if (slug) {
    currentProject = projects.find((p) => p.slug === slug) || null;
  }

  if (!currentProject && projects.length > 0) {
    currentProject = projects[0];
  }

  return { projects, isAdmin, currentProject, client };
}
