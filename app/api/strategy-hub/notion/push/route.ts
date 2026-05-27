import { NextRequest, NextResponse } from "next/server";
import { pushBusinessStrategyToNotion } from "@/lib/strategy-hub/notion-sync";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getStrategyHubAccess();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = (await req.json().catch(() => ({}))) as {
    projectId?: string;
  };
  if (!projectId) {
    return NextResponse.json({ error: "projectId wymagane" }, { status: 400 });
  }

  try {
    const result = await pushBusinessStrategyToNotion(projectId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
