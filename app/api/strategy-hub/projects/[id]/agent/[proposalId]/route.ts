import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { acceptProposal, rejectProposal } from "@/lib/strategy-hub/agent/accept-proposal";

const bodySchema = z.object({ action: z.enum(["accept", "reject"]) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const { id, proposalId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result =
    parsed.data.action === "accept"
      ? await acceptProposal(id, proposalId)
      : await rejectProposal(id, proposalId);

  if ("ok" in result && !result.ok) {
    return NextResponse.json({ error: result.error ?? "failed" }, { status: 400 });
  }
  return NextResponse.json(result);
}
