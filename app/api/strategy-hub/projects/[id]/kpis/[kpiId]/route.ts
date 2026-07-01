import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import { trackChange } from "@/lib/strategy-hub/track-change";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kpiId: string }> }
) {
  const { id, kpiId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getListEntity("kpis");
  if (!entity) return notFound("Entity");

  const parsed = entity.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.update(id, kpiId, parsed.data);
  if (!item) return notFound("KPI");

  await trackChange({
    projectId: id,
    entityType: "kpi",
    entityId: kpiId,
    patch: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; kpiId: string }> }
) {
  const { id, kpiId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getListEntity("kpis");
  if (!entity) return notFound("Entity");

  const ok = await entity.softDelete(id, kpiId);
  if (!ok) return notFound("KPI");
  return NextResponse.json({ ok: true });
}
