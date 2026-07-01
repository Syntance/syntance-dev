import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  requireProjectReadAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getPageChild } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string; child: string }> }
) {
  const { id, pageId, child } = await params;
  const auth = await requireProjectReadAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getPageChild(child);
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(pageId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string; child: string }> }
) {
  const { id, pageId, child } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getPageChild(child);
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(pageId, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
