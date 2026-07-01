import { NextRequest, NextResponse } from "next/server";
import { pushBusinessStrategyToNotion } from "@/lib/strategy-hub/notion-sync";
import { assertProjectAccess } from "@/lib/strategy-hub/context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { projectId } = (await req.json().catch(() => ({}))) as {
    projectId?: string;
  };
  if (!projectId) {
    return NextResponse.json({ error: "projectId wymagane" }, { status: 400 });
  }

  // Izolacja workspace: bez tego dowolny zalogowany admin mógł wypchnąć
  // treść do Notion dowolnego projektu, nawet spoza własnego workspace.
  const access = await assertProjectAccess(projectId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized" : "Project not found" },
      { status: access.status }
    );
  }

  try {
    const result = await pushBusinessStrategyToNotion(projectId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
