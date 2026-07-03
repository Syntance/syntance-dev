import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { undoBatch } from "@/lib/strategy-hub/undo";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  const { id, batchId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const actorId =
    auth.access.type === "admin"
      ? auth.access.session.adminId
      : auth.access.session.userId;

  const result = await undoBatch(id, batchId, actorId);
  return NextResponse.json({ ok: true, ...result });
}

