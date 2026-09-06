import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { organizationBranding } from "@/db/schema";
import { getAdminSession } from "@/lib/auth";
import { getCurrentOrganizationForAdmin } from "@/lib/strategy-hub/context";
import { getOrganizationBranding } from "@/lib/client-portal/branding";

const ColorSchema = z.object({
  name: z.string().min(1).max(60),
  value: z.string().min(1).max(60),
  role: z.enum(["brand", "brand-light"]),
});

const BrandingPatchSchema = z.object({
  logoUrl: z.string().url().max(500).nullable().optional(),
  colors: z.array(ColorSchema).max(4).optional(),
  customDomain: z
    .string()
    .max(255)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Nieprawidłowa domena")
    .nullable()
    .optional(),
});

/** Branding bieżącej organizacji admina (wybór z ciasteczka `sh_org`). */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organization = await getCurrentOrganizationForAdmin(session.email);
  const branding = await getOrganizationBranding(organization.id);
  return NextResponse.json({ branding });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BrandingPatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nieprawidłowe dane", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Zapis zawsze na bieżącej organizacji admina — członkostwo weryfikuje
  // `getCurrentOrganizationForAdmin`, więc branding jednego klienta nie może
  // nadpisać brandingu innego.
  const organization = await getCurrentOrganizationForAdmin(session.email);

  await db
    .insert(organizationBranding)
    .values({
      organizationId: organization.id,
      logoFileId: parsed.data.logoUrl ?? null,
      colors: parsed.data.colors ?? [],
      customDomain: parsed.data.customDomain ?? null,
      status: "active",
    })
    .onConflictDoUpdate({
      target: organizationBranding.organizationId,
      set: {
        logoFileId: parsed.data.logoUrl ?? null,
        colors: parsed.data.colors ?? [],
        customDomain: parsed.data.customDomain ?? null,
        updatedAt: new Date(),
      },
    });

  const branding = await getOrganizationBranding(organization.id);
  return NextResponse.json({ branding });
}
