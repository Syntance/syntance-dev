import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businessProblems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

const patchSchema = z.object({
  problemMd: z.string().min(1).optional(),
  ambitionMd: z.string().optional().nullable(),
  ourSolutionMd: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(3).optional(),
  orderIdx: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id, itemId } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(data).length === 0) return badRequest("No fields to update");

  const updated = await db
    .update(businessProblems)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(businessProblems.id, itemId),
        eq(businessProblems.projectId, id)
      )
    )
    .returning();

  if (!updated[0]) return notFound("Problem");
  return NextResponse.json({ item: updated[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id, itemId } = await params;

  const updated = await db
    .update(businessProblems)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(businessProblems.id, itemId),
        eq(businessProblems.projectId, id)
      )
    )
    .returning({ id: businessProblems.id });

  if (!updated[0]) return notFound("Problem");
  return NextResponse.json({ ok: true });
}
