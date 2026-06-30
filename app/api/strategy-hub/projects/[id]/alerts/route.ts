import { NextResponse } from "next/server";
import { getProjectAlerts } from "@/lib/strategy-hub/alerts";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const alerts = await getProjectAlerts(id);
  return NextResponse.json({ alerts });
}
