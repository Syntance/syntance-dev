import { sanityClient } from "./client";

export interface SanityProject {
  _id: string;
  name: string;
  slug: string;
  clientEmail: string;
  clientName: string | null;
  clientPassword: string | null;
  previewUrl: string;
  status: string;
  description: string | null;
  isAdmin: boolean;
  _createdAt: string;
  _updatedAt: string;
}

const PROJECT_FIELDS = `
  _id,
  name,
  "slug": slug.current,
  clientEmail,
  clientName,
  clientPassword,
  previewUrl,
  status,
  description,
  isAdmin,
  _createdAt,
  _updatedAt
`;

export async function getProjectBySlug(
  slug: string
): Promise<SanityProject | null> {
  return sanityClient.fetch(
    `*[_type == "project" && slug.current == $slug][0]{ ${PROJECT_FIELDS} }`,
    { slug }
  );
}

export async function getProjectsByEmail(
  email: string
): Promise<SanityProject[]> {
  return sanityClient.fetch(
    `*[_type == "project" && clientEmail == $email] | order(_createdAt desc) { ${PROJECT_FIELDS} }`,
    { email }
  );
}

export async function getAllProjects(): Promise<SanityProject[]> {
  return sanityClient.fetch(
    `*[_type == "project"] | order(_createdAt desc) { ${PROJECT_FIELDS} }`
  );
}

export async function isEmailAdmin(email: string): Promise<boolean> {
  const result = await sanityClient.fetch(
    `count(*[_type == "project" && clientEmail == $email && isAdmin == true]) > 0`,
    { email }
  );
  return result;
}

export async function getProjectsForUser(
  email: string
): Promise<{ projects: SanityProject[]; isAdmin: boolean }> {
  const adminCheck = await isEmailAdmin(email);
  
  if (adminCheck) {
    const projects = await getAllProjects();
    return { projects, isAdmin: true };
  }
  
  const projects = await getProjectsByEmail(email);
  return { projects, isAdmin: false };
}
