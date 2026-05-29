import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const pathId = new URL(req.url).searchParams.get("pathId") || undefined;

  const entity = getListEntity("kpis");
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(id, pathId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getListEntity("kpis");
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(id, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
