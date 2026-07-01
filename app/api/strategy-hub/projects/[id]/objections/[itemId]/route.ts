import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { objections } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { trackChange } from "@/lib/strategy-hub/track-change";
import { applyReviewPropagation, clearReviewFlag } from "@/lib/strategy-hub/rules/apply-review";

const STAGES = ["TOFU", "MOFU", "BOFU", "retention"] as const;
const STATUSES = ["active", "resolved", "needs_proof"] as const;

const patchSchema = z.object({
  objectionMd: z.string().min(1).optional(),
  responseMd: z.string().optional().nullable(),
  proofMd: z.string().optional().nullable(),
  segmentId: z.string().uuid().optional().nullable(),
  stage: z.enum(STAGES).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  orderIdx: z.number().int().optional(),
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
    .update(objections)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(objections.id, itemId), eq(objections.projectId, id)))
    .returning();

  if (!updated[0]) return notFound("Objection");

  await trackChange({
    projectId: id,
    entityType: "objection",
    entityId: itemId,
    patch: data,
  });

  await clearReviewFlag("objections", itemId);
  await applyReviewPropagation(id, "objections");

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
    .update(objections)
    .set({ deletedAt: new Date() })
    .where(and(eq(objections.id, itemId), eq(objections.projectId, id)))
    .returning({ id: objections.id });

  if (!updated[0]) return notFound("Objection");
  return NextResponse.json({ ok: true });
}
