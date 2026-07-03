import "server-only";
import { db } from "@/db";
import { projects, workspaceBranding } from "@/db/schema";
import { eq } from "drizzle-orm";

interface BrandColor {
  name: string;
  value: string;
  /** np. 'brand' | 'brand-light' — nazwa CSS custom property do nadpisania. */
  role: string;
}

export interface WorkspaceBranding {
  logoUrl: string | null;
  colors: BrandColor[];
  customDomain: string | null;
}

/**
 * White-label (Faza 15/17): branding portalu klienta pobierany po projekcie,
 * bo layout klienta zna tylko `slug` -> `projectId`, nigdy `workspaceId`
 * bezpośrednio. `logoFileId` przechowuje pełny URL (brak infrastruktury
 * uploadu plików w repo — patrz ADR w komentarzu do settings/branding).
 */
export async function getWorkspaceBrandingForProject(
  projectId: string
): Promise<WorkspaceBranding | null> {
  const [row] = await db
    .select({
      logoFileId: workspaceBranding.logoFileId,
      colors: workspaceBranding.colors,
      customDomain: workspaceBranding.customDomain,
      status: workspaceBranding.status,
    })
    .from(projects)
    .innerJoin(workspaceBranding, eq(workspaceBranding.workspaceId, projects.workspaceId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row || row.status !== "active") return null;

  const colors = Array.isArray(row.colors) ? (row.colors as BrandColor[]) : [];
  if (!row.logoFileId && colors.length === 0) return null;

  return {
    logoUrl: row.logoFileId ?? null,
    colors,
    customDomain: row.customDomain ?? null,
  };
}

export async function getWorkspaceBrandingForWorkspace(
  workspaceId: string
): Promise<WorkspaceBranding & { status: string }> {
  const [row] = await db
    .select()
    .from(workspaceBranding)
    .where(eq(workspaceBranding.workspaceId, workspaceId))
    .limit(1);

  return {
    logoUrl: row?.logoFileId ?? null,
    colors: Array.isArray(row?.colors) ? (row.colors as BrandColor[]) : [],
    customDomain: row?.customDomain ?? null,
    status: row?.status ?? "active",
  };
}
