import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import {
  listRelations,
  createRelation,
} from "@/lib/strategy-hub/relations/store";
import {
  relationCreateSchema,
  relationListQuerySchema,
} from "@/lib/strategy-hub/relations/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = relationListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return badRequest("Invalid query", parsed.error.flatten());
  }

  const { entityType, entityId, source, type } = parsed.data;
  const entity =
    entityType && entityId ? { type: entityType, id: entityId } : undefined;

  const relations = await listRelations(projectId, {
    type,
    source,
    entity,
  });

  return NextResponse.json({ relations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const body: unknown = await req.json();
  const parsed = relationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  try {
    const relation = await createRelation(projectId, parsed.data, {
      source: "human",
      userId: null,
    });
    return NextResponse.json({ relation }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Błąd tworzenia relacji";
    return badRequest(message);
  }
}
