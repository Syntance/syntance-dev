import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import "@/lib/strategy-hub/entities/extended-registry";
import {
  getListEntity,
  getSingletonEntity,
} from "@/lib/strategy-hub/entities/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string }> }
) {
  const { id, entity } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const pathId = new URL(req.url).searchParams.get("pathId") || undefined;
  const siteId = new URL(req.url).searchParams.get("siteId") || undefined;
  const entityType = new URL(req.url).searchParams.get("entityType") || undefined;
  const entityId = new URL(req.url).searchParams.get("entityId") || undefined;

  if (entity === "comments" && entityType && entityId) {
    const { listEntityComments } = await import(
      "@/lib/strategy-hub/entities/extended-registry"
    );
    return NextResponse.json({
      items: await listEntityComments(id, entityType, entityId),
    });
  }

  const list = getListEntity(entity);
  if (list) return NextResponse.json({ items: await list.list(id, pathId, siteId) });

  const singleton = getSingletonEntity(entity);
  if (singleton)
    return NextResponse.json({ item: (await singleton.get(id)) ?? null });

  return notFound("Entity");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string }> }
) {
  const { id, entity } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  const parsed = list.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await list.create(id, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string }> }
) {
  const { id, entity } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const singleton = getSingletonEntity(entity);
  if (!singleton) return notFound("Entity");

  const parsed = singleton.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await singleton.upsert(id, parsed.data);
  return NextResponse.json({ item });
}
