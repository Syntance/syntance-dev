import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { workspaceBranding } from "@/db/schema";
import { getAdminSession } from "@/lib/auth";
import { getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import { getWorkspaceBrandingForWorkspace } from "@/lib/client-portal/branding";

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

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await getOrCreateWorkspaceForAdmin(session.email);
  const branding = await getWorkspaceBrandingForWorkspace(ws.id);
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

  const ws = await getOrCreateWorkspaceForAdmin(session.email);

  await db
    .insert(workspaceBranding)
    .values({
      workspaceId: ws.id,
      logoFileId: parsed.data.logoUrl ?? null,
      colors: parsed.data.colors ?? [],
      customDomain: parsed.data.customDomain ?? null,
      status: "active",
    })
    .onConflictDoUpdate({
      target: workspaceBranding.workspaceId,
      set: {
        logoFileId: parsed.data.logoUrl ?? null,
        colors: parsed.data.colors ?? [],
        customDomain: parsed.data.customDomain ?? null,
        updatedAt: new Date(),
      },
    });

  const branding = await getWorkspaceBrandingForWorkspace(ws.id);
  return NextResponse.json({ branding });
}
