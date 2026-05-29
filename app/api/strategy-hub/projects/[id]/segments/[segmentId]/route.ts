import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  const { id, segmentId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getListEntity("segments");
  if (!entity) return notFound("Entity");

  const parsed = entity.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.update(id, segmentId, parsed.data);
  if (!item) return notFound("Segment");
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  const { id, segmentId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getListEntity("segments");
  if (!entity) return notFound("Entity");

  const ok = await entity.softDelete(id, segmentId);
  if (!ok) return notFound("Segment");
  return NextResponse.json({ ok: true });
}
