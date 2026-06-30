import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import {
  suggestFunnelRelations,
  applyFunnelRelations,
} from "@/lib/strategy-hub/auto-relations";

// GET — podgląd proponowanych relacji (bez zapisu).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const suggestions = await suggestFunnelRelations(projectId);
  return NextResponse.json({ suggestions });
}

const applySchema = z.object({
  relations: z.array(
    z.object({
      elementId: z.string().uuid(),
      kind: z.enum(["campaign", "channel", "kpi"]),
      targetId: z.string().uuid(),
    })
  ),
});

// POST — zapisuje wybrane relacje (addytywnie).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = applySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const result = await applyFunnelRelations(projectId, parsed.data.relations);

  revalidatePath(`/strategy-hub/projects/${projectId}`);
  revalidatePath(`/strategy-hub/projects/${projectId}/execution/channels`);

  return NextResponse.json({ ok: true, ...result });
}
