import { sanityClient } from "./client";

export interface SanityProject {
  _id: string;
  name: string;
  slug: string;
  clientEmail: string;
  clientName: string | null;
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
  clientEmail,
  clientName,
  previewUrl,
  status,
  description,
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
