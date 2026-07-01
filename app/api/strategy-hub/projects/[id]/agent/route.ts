import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { aiProposals } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AGENT_MODES, runAgentMode } from "@/lib/strategy-hub/agent/run-agent";

const bodySchema = z.object({ mode: z.enum(AGENT_MODES) });

// GET — lista propozycji (domyślnie wszystkie, ?status=pending do filtrowania)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const status = req.nextUrl.searchParams.get("status");

  const items = await db
    .select()
    .from(aiProposals)
    .where(
      status
        ? and(eq(aiProposals.projectId, id), eq(aiProposals.status, status))
        : eq(aiProposals.projectId, id)
    )
    .orderBy(desc(aiProposals.createdAt))
    .limit(100);

  return NextResponse.json({ items });
}

// POST — uruchamia jeden z 4 trybów agenta; zapisuje wyłącznie do ai_proposals
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runAgentMode(id, parsed.data.mode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("agent run failed", err);
    return NextResponse.json({ error: "Agent nie mógł wygenerować propozycji" }, { status: 500 });
  }
}
