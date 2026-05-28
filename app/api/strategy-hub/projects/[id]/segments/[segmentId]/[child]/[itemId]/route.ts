import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getSegmentChild } from "@/lib/strategy-hub/entities/registry";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ segmentId: string; child: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { segmentId, child, itemId } = await params;

  const entity = getSegmentChild(child);
  if (!entity) return notFound("Entity");

  const parsed = entity.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.update(segmentId, itemId, parsed.data);
  if (!item) return notFound(entity.label);
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ segmentId: string; child: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { segmentId, child, itemId } = await params;

  const entity = getSegmentChild(child);
  if (!entity) return notFound("Entity");

  const ok = await entity.softDelete(segmentId, itemId);
  if (!ok) return notFound(entity.label);
  return NextResponse.json({ ok: true });
}
