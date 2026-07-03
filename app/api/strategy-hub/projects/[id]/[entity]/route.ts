import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  requireProjectReadAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import "@/lib/strategy-hub/entities/extended-registry";
import {
  getListEntity,
  getSingletonEntity,
} from "@/lib/strategy-hub/entities/registry";
import { trackChange, entityTypeFor } from "@/lib/strategy-hub/track-change";
import {
  filterRecordsForClient,
  getProjectVisibility,
} from "@/lib/strategy-hub/visibility";

const CLIENT_FILTER_ENTITIES: Record<string, string> = {
  segments: "segments",
  channels: "channels",
  "channel-activity-plan": "channel_activity_plan",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string }> }
) {
  const { id, entity } = await params;
  const auth = await requireProjectReadAccess(id);
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
  if (list) {
    let items = await list.list(id, pathId, siteId);
    if (auth.role === "client") {
      const vis = await getProjectVisibility(id);
      const entityType = CLIENT_FILTER_ENTITIES[entity];
      if (entityType) {
        items = filterRecordsForClient(
          items as Array<{ id: string }>,
          vis,
          entityType
        );
      }
    }
    return NextResponse.json({ items });
  }

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

  const itemId = typeof item?.id === "string" ? item.id : null;
  if (itemId) {
    await trackChange({
      projectId: id,
      entityType: entityTypeFor(entity),
      entityId: itemId,
      patch: { __created: true, ...(parsed.data as Record<string, unknown>) },
    });
  }

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
