import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectReadAccess } from "@/lib/strategy-hub/api-helpers";
import { getJourneyView } from "@/lib/strategy-hub/journey-data";

const querySchema = z.object({
  segment: z.string().uuid().nullable().optional(),
});

/** Podróż zakupowa segmentu + pokrycie etapów (gap engine). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectReadAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse({
    segment: req.nextUrl.searchParams.get("segment"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nieprawidłowy parametr segment", code: "invalid_params" },
      { status: 400 }
    );
  }

  const data = await getJourneyView(projectId, parsed.data.segment ?? null);
  return NextResponse.json(data);
}
