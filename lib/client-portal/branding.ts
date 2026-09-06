import "server-only";
import { db } from "@/db";
import { projects, organizationBranding } from "@/db/schema";
import { eq } from "drizzle-orm";

interface BrandColor {
  name: string;
  value: string;
  /** np. 'brand' | 'brand-light' — nazwa CSS custom property do nadpisania. */
  role: string;
}

export interface OrganizationBranding {
  logoUrl: string | null;
  colors: BrandColor[];
  customDomain: string | null;
}

/**
 * White-label (Faza 15/17): branding portalu klienta pobierany po projekcie,
 * bo layout klienta zna tylko `slug` -> `projectId`, nigdy `organizationId`
 * bezpośrednio. Ścieżka: projekt -> `projects.organizationId` ->
 * `organizationBranding`. Dzięki temu każda organizacja (klient) ma własny
 * branding, a nie jeden wspólny dla całej agencji. `logoFileId` przechowuje
 * pełny URL (brak infrastruktury uploadu plików w repo — patrz ADR
 * w komentarzu do settings/branding).
 */
export async function getOrganizationBrandingForProject(
  projectId: string
): Promise<OrganizationBranding | null> {
  const [row] = await db
    .select({
      logoFileId: organizationBranding.logoFileId,
      colors: organizationBranding.colors,
      customDomain: organizationBranding.customDomain,
      status: organizationBranding.status,
    })
    .from(projects)
    .innerJoin(
      organizationBranding,
      eq(organizationBranding.organizationId, projects.organizationId)
    )
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

/** Branding jednej organizacji (panel ustawień) — brak wiersza = wartości domyślne. */
export async function getOrganizationBranding(
  organizationId: string
): Promise<OrganizationBranding & { status: string }> {
  const [row] = await db
    .select()
    .from(organizationBranding)
    .where(eq(organizationBranding.organizationId, organizationId))
    .limit(1);

  return {
    logoUrl: row?.logoFileId ?? null,
    colors: Array.isArray(row?.colors) ? (row.colors as BrandColor[]) : [],
    customDomain: row?.customDomain ?? null,
    status: row?.status ?? "active",
  };
}
