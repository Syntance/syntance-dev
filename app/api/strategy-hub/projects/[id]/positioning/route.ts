import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brandPositioning } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

/** Quadrant współrzędne: -1.0 (lewo/dół) → 0 (środek) → 1.0 (prawo/góra). */
const coord = z.number().min(-1).max(1);

const competitorMarkerSchema = z.object({
  /** ID encji z `competitors` lub luźny label, gdy konkurent nie jest jeszcze w bazie. */
  id: z.string().optional(),
  label: z.string().min(1),
  x: coord,
  y: coord,
});

const patchSchema = z.object({
  axisXLabel: z.string().max(100).optional().nullable(),
  axisYLabel: z.string().max(100).optional().nullable(),
  ourX: coord.optional().nullable(),
  ourY: coord.optional().nullable(),
  ourLabel: z.string().max(100).optional().nullable(),
  competitorsOnQuadrant: z.array(competitorMarkerSchema).optional().nullable(),
  statementMd: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const rows = await db
    .select()
    .from(brandPositioning)
    .where(eq(brandPositioning.projectId, id))
    .limit(1);
  return NextResponse.json({ item: rows[0] ?? null });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(data).length === 0) return badRequest("No fields to update");

  const result = await db
    .insert(brandPositioning)
    .values({ projectId: id, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: brandPositioning.projectId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ item: result[0] });
}
