import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { strategyPaths } from "@/db/schema";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  isDefault: z.boolean().optional(),
  orderIdx: z.number().int().optional(),
  status: z.string().max(50).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pathId: string }> }
) {
  const { id, pathId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const [updated] = await db
    .update(strategyPaths)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(eq(strategyPaths.id, pathId), eq(strategyPaths.projectId, id))
    )
    .returning();

  if (!updated) return notFound("Path");
  return NextResponse.json({ path: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pathId: string }> }
) {
  const { id, pathId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const [deleted] = await db
    .update(strategyPaths)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(strategyPaths.id, pathId), eq(strategyPaths.projectId, id))
    )
    .returning({ id: strategyPaths.id });

  if (!deleted) return notFound("Path");
  return NextResponse.json({ ok: true });
}
