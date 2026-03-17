import { sanityClient } from "./client";

export interface SanityClient {
  _id: string;
  name: string;
  email: string;
  company: string | null;
  password: string | null;
  isAdmin: boolean;
}

export interface SanityProject {
  _id: string;
  name: string;
  slug: string;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  previewUrl: string;
  status: string;
  description: string | null;
  _createdAt: string;
  _updatedAt: string;
}

const CLIENT_FIELDS = `
  _id,
  name,
  email,
  company,
  password,
  isAdmin
`;

const PROJECT_FIELDS = `
  _id,
  name,
  "slug": slug.current,
  "clientId": client._ref,
  "clientName": client->name,
  "clientEmail": client->email,
  previewUrl,
  status,
  description,
  _createdAt,
  _updatedAt
`;

export async function getClientByEmail(
  email: string
): Promise<SanityClient | null> {
  return sanityClient.fetch(
    `*[_type == "client" && email == $email][0]{ ${CLIENT_FIELDS} }`,
    { email }
  );
}

export async function getProjectBySlug(
  slug: string
): Promise<SanityProject | null> {
  return sanityClient.fetch(
    `*[_type == "project" && slug.current == $slug][0]{ ${PROJECT_FIELDS} }`,
    { slug }
  );
}

export async function getProjectsByClientId(
  clientId: string
): Promise<SanityProject[]> {
  return sanityClient.fetch(
    `*[_type == "project" && client._ref == $clientId] | order(_createdAt desc) { ${PROJECT_FIELDS} }`,
    { clientId }
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
  
  const projects = await getProjectsByClientId(client._id);
  return { projects, isAdmin: false, client };
}
