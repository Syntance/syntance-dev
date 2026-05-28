import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id, entity, itemId } = await params;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  const parsed = list.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await list.update(id, itemId, parsed.data);
  if (!item) return notFound(list.label);
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string; itemId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id, entity, itemId } = await params;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  const ok = await list.softDelete(id, itemId);
  if (!ok) return notFound(list.label);
  return NextResponse.json({ ok: true });
}
