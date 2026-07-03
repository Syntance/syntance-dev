import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import {
  updateRelation,
  softDeleteRelation,
} from "@/lib/strategy-hub/relations/store";
import { relationPatchSchema } from "@/lib/strategy-hub/relations/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; relationId: string }> }
) {
  const { id: projectId, relationId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = relationPatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const relation = await updateRelation(projectId, relationId, parsed.data, {
    userId: null,
  });

  if (!relation) return notFound("Relacja nie znaleziona");
  return NextResponse.json({ relation });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; relationId: string }> }
) {
  const { id: projectId, relationId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const ok = await softDeleteRelation(projectId, relationId, {
    userId: null,
  });

  if (!ok) return notFound("Relacja nie znaleziona");
  return NextResponse.json({ ok: true });
}
