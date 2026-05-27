import { NextRequest, NextResponse } from "next/server";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";
import { getProjectById } from "@/lib/strategy-hub/context";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getStrategyHubAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      icon: project.icon,
    },
  });
}
