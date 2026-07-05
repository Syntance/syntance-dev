import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectReadAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { ENTITY_TYPE_META } from "@/lib/strategy-hub/entities/entity-types";
import { getThread } from "@/lib/strategy-hub/thread-data";

const entityTypeKeys = Object.keys(ENTITY_TYPE_META) as [
  keyof typeof ENTITY_TYPE_META,
  ...(keyof typeof ENTITY_TYPE_META)[],
];

const querySchema = z.object({
  type: z.enum(entityTypeKeys),
  id: z.string().uuid(),
  mode: z.enum(["editor", "client"]).optional().default("editor"),
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

  const mode = auth.role === "client" ? "client" : parsed.data.mode;

  try {
    const data = await getThread(
      projectId,
      { type: parsed.data.type, id: parsed.data.id },
      mode
    );
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Thread not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
