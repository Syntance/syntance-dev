import { NextRequest, NextResponse } from "next/server";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { getDecisionsLedger } from "@/lib/strategy-hub/decisions-ledger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireStrategyHubAccess().catch(() => null);
  if (!access) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const data = await getDecisionsLedger(projectId);
    return NextResponse.json({ decisions: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ledger error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
