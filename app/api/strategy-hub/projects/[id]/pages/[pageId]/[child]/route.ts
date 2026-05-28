import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getPageChild } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string; child: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { pageId, child } = await params;

  const entity = getPageChild(child);
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(pageId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; child: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { pageId, child } = await params;

  const entity = getPageChild(child);
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(pageId, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
