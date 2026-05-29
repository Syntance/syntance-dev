import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

const TYPES = ["direct", "indirect", "none"] as const;
const coord = z.number().min(-1).max(1);

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional().nullable(),
  type: z.enum(TYPES).optional(),
  segmentId: z.string().uuid().optional().nullable(),
  strengthsMd: z.string().optional().nullable(),
  weaknessesMd: z.string().optional().nullable(),
  pricingMd: z.string().optional().nullable(),
  channelsMd: z.string().optional().nullable(),
  notesMd: z.string().optional().nullable(),
  quadrantX: coord.optional().nullable(),
  quadrantY: coord.optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(data).length === 0) return badRequest("No fields to update");

  const updated = await db
    .update(competitors)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(competitors.id, itemId), eq(competitors.projectId, id)))
    .returning();

  if (!updated[0]) return notFound("Competitor");
  return NextResponse.json({ item: updated[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const updated = await db
    .update(competitors)
    .set({ deletedAt: new Date() })
    .where(and(eq(competitors.id, itemId), eq(competitors.projectId, id)))
    .returning({ id: competitors.id });

  if (!updated[0]) return notFound("Competitor");
  return NextResponse.json({ ok: true });
}
