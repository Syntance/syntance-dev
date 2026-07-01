import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  requireProjectReadAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getKpiChild } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; kpiId: string; child: string }> }
) {
  const { id, kpiId, child } = await params;
  const auth = await requireProjectReadAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getKpiChild(child);
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(kpiId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kpiId: string; child: string }> }
) {
  const { id, kpiId, child } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getKpiChild(child);
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(kpiId, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
