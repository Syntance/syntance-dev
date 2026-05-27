import { sanityClient } from "./client";

export interface SanityClient {
  _id: string;
  name: string;
  email: string;
  company: string | null;
  password: string | null;
  isAdmin: boolean;
  projects: SanityProject[];
}

export interface SanityProject {
  _id: string;
  name: string;
  slug: string;
  clientDomain: string | null;
  previewUrl: string;
  status: string;
  description: string | null;
  _createdAt: string;
  _updatedAt: string;
}

const PROJECT_FIELDS = `
  _id,
  name,
  "slug": slug.current,
  clientDomain,
  previewUrl,
  status,
  description,
  _createdAt,
  _updatedAt
`;

const CLIENT_FIELDS = `
  _id,
  name,
  email,
  company,
  password,
  isAdmin,
  "projects": projects[]->{ ${PROJECT_FIELDS} }
`;

export async function getClientByEmail(
  email: string
): Promise<SanityClient | null> {
  return sanityClient.fetch(
    `*[_type == "client" && email == $email][0]{ ${CLIENT_FIELDS} }`,
    { email }
  );
}

export async function getAllProjects(): Promise<SanityProject[]> {
  return sanityClient.fetch(
    `*[_type == "project"] | order(_createdAt desc) { ${PROJECT_FIELDS} }`
  );
}

export async function getProjectsForUser(
  email: string
): Promise<{ projects: SanityProject[]; isAdmin: boolean; client: SanityClient | null }> {
  const client = await getClientByEmail(email);
  
  if (!client) {
    return { projects: [], isAdmin: false, client: null };
  }
  
  if (client.isAdmin) {
    const projects = await getAllProjects();
    return { projects, isAdmin: true, client };
  }
  
  const projects = client.projects || [];
  return { projects, isAdmin: false, client };
}

export async function getProjectBySlugForUser(
  slug: string,
  email: string
): Promise<SanityProject | null> {
  const { projects, isAdmin } = await getProjectsForUser(email);
  
  if (isAdmin) {
    return sanityClient.fetch(
      `*[_type == "project" && slug.current == $slug][0]{ ${PROJECT_FIELDS} }`,
      { slug }
    );
  }
  
  return projects.find((p) => p.slug === slug) ?? null;
}

export async function getProjectClients(
  slug: string
): Promise<{ email: string; name?: string }[]> {
  const result = await sanityClient.fetch<
    { email: string; name?: string }[] | null
  >(
    `*[_type == "client" && count(projects[@._ref in *[_type=="project" && slug.current==$slug]._id]) > 0]{ email, name }`,
    { slug }
  );
  return result ?? [];
}
