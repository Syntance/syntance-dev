import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import { trackChange, entityTypeFor } from "@/lib/strategy-hub/track-change";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string; itemId: string }> }
) {
  const { id, entity, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  const parsed = list.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await list.update(id, itemId, parsed.data);
  if (!item) return notFound(list.label);

  await trackChange({
    projectId: id,
    entityType: entityTypeFor(entity),
    entityId: itemId,
    patch: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string; itemId: string }> }
) {
  const { id, entity, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  const ok = await list.softDelete(id, itemId);
  if (!ok) return notFound(list.label);
  return NextResponse.json({ ok: true });
}
