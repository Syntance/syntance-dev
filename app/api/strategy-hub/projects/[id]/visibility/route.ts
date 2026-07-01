import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess, requireProjectReadAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import {
  getProjectVisibility,
  setVisibility,
} from "@/lib/strategy-hub/visibility";

const patchSchema = z.object({
  scope: z.enum(["module", "record"]),
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid().nullish(),
  status: z.enum(["visible", "hidden", "in_progress"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectReadAccess(id);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getProjectVisibility(id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  if (parsed.data.scope === "record" && !parsed.data.entityId) {
    return badRequest("entityId wymagane dla scope=record");
  }

  await setVisibility({
    projectId: id,
    scope: parsed.data.scope,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId ?? null,
    status: parsed.data.status,
  });

  return NextResponse.json({ ok: true });
}
