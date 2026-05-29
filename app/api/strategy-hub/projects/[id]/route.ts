import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const { project } = auth;
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      icon: project.icon,
    },
  });
}
