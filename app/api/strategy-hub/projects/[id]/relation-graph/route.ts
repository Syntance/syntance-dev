import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { getRelationGraphData } from "@/lib/strategy-hub/relation-graph";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const data = await getRelationGraphData(id);
  return NextResponse.json(data);
}

const layoutSchema = z.object({
  layout: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
});

/**
 * Zapisuje pozycje węzłów grafu relacji ustawione ręcznie przez usera
 * (drag w React Flow) do `projects.graph_layout`, keyed by node id.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = layoutSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  await db
    .update(projects)
    .set({ graphLayout: parsed.data.layout })
    .where(eq(projects.id, id));

  return NextResponse.json({ ok: true });
}
