import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import { foundationKeyForRoute } from "@/lib/strategy-hub/scope";
import { trackChange, entityTypeFor } from "@/lib/strategy-hub/track-change";
import { applyReviewPropagation, clearReviewFlag } from "@/lib/strategy-hub/rules/apply-review";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entity: string; itemId: string }> }
) {
  const { id, entity, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const list = getListEntity(entity);
  if (!list) return notFound("Entity");

  // Encje fundamentu (W0) w projekcie dziedziczącym leżą w projekcie-źródle,
  // więc `WHERE projectId = id` i tak by ich nie trafiło — zamiast mylącego
  // 404 zwracamy jawne 409 z instrukcją, tak jak dedykowane route'y fundamentu.
  if (foundationKeyForRoute(entity)) {
    const own = await requireOwnFoundation(id);
    if (!own.ok) return own.response;
  }

  const parsed = list.patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const patchData = parsed.data as Record<string, unknown>;
  const beforeRow = list.get
    ? await list.get(id, itemId)
    : (await list.list(id)).find((row) => row.id === itemId);
  const before =
    beforeRow && typeof beforeRow === "object"
      ? Object.fromEntries(
          Object.keys(patchData).map((key) => [key, beforeRow[key]])
        )
      : undefined;

  const item = await list.update(id, itemId, parsed.data);
  if (!item) return notFound(list.label);

  await trackChange({
    projectId: id,
    entityType: entityTypeFor(entity),
    entityId: itemId,
    patch: patchData,
    before,
  });

  // Propagacja „do przeglądu" (spec): encja właśnie zapisana = przejrzana;
  // downstream moduły, które ją czytają w „Wejściach", dostają review_flag.
  await clearReviewFlag(entity, itemId);
  await applyReviewPropagation(id, entity);

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

  // Encje fundamentu (W0) w projekcie dziedziczącym leżą w projekcie-źródle,
  // więc `WHERE projectId = id` i tak by ich nie trafiło — zamiast mylącego
  // 404 zwracamy jawne 409 z instrukcją, tak jak dedykowane route'y fundamentu.
  if (foundationKeyForRoute(entity)) {
    const own = await requireOwnFoundation(id);
    if (!own.ok) return own.response;
  }

  const ok = await list.softDelete(id, itemId);
  if (!ok) return notFound(list.label);

  await trackChange({
    projectId: id,
    entityType: entityTypeFor(entity),
    entityId: itemId,
    patch: { __deleted: true },
  });

  return NextResponse.json({ ok: true });
}
