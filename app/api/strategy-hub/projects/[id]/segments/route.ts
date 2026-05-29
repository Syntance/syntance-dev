import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const pathId = new URL(req.url).searchParams.get("pathId") || undefined;

  const entity = getListEntity("segments");
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(id, pathId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const entity = getListEntity("segments");
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(id, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
