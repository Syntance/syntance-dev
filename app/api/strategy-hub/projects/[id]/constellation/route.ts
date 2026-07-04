import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectReadAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import {
  getConstellationScene,
  parseConstellationScene,
} from "@/lib/strategy-hub/constellation-scenes";

const querySchema = z.object({
  mode: z.enum(["editor", "client"]).optional().default("editor"),
  level: z.enum(["organism", "area", "entity"]).optional(),
  area: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  type: z.string().optional(),
  id: z.string().optional(),
  focus: z.string().optional(),
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
  const scene = parseConstellationScene(parsed.data);

  try {
    const data = await getConstellationScene(projectId, scene, mode);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
