import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectReadAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { ENTITY_TYPE_META } from "@/lib/strategy-hub/entities/entity-types";
import { getEntitySummary } from "@/lib/strategy-hub/constellation-entity-summary";

const entityTypeKeys = Object.keys(ENTITY_TYPE_META) as [
  keyof typeof ENTITY_TYPE_META,
  ...(keyof typeof ENTITY_TYPE_META)[],
];

const querySchema = z.object({
  type: z.enum(entityTypeKeys),
  id: z.string().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectReadAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return badRequest("Invalid query", parsed.error.flatten());
  }

  try {
    const summary = await getEntitySummary(
      projectId,
      parsed.data.type,
      parsed.data.id
    );
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summary error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
