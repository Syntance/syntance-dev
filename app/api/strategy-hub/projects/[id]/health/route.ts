import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  try {
    const health = await computeProjectHealth(id);
    return NextResponse.json(health);
  } catch {
    return NextResponse.json(
      { error: "Nie udało się policzyć health score" },
      { status: 500 }
    );
  }
}
