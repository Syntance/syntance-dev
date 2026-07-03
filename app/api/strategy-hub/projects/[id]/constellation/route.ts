import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectReadAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { getConstellationData } from "@/lib/strategy-hub/constellation-data";

const querySchema = z.object({
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

  const mode =
    auth.role === "client" ? "client" : parsed.data.mode;

  const data = await getConstellationData(projectId, mode);
  return NextResponse.json(data);
}
