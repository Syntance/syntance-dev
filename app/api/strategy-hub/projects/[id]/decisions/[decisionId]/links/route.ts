import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  strategicDecisions,
  decisionLinks,
} from "@/db/schema";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const linkSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  role: z.enum(["cause", "effect"]),
});

const putSchema = z.object({
  links: z.array(linkSchema),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: projectId, decisionId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const [decision] = await db
    .select({ id: strategicDecisions.id })
    .from(strategicDecisions)
    .where(
      and(
        eq(strategicDecisions.id, decisionId),
        eq(strategicDecisions.projectId, projectId)
      )
    )
    .limit(1);

  if (!decision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = await db
    .select()
    .from(decisionLinks)
    .where(eq(decisionLinks.decisionId, decisionId));

  return NextResponse.json({ links });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: projectId, decisionId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const [decision] = await db
    .select({ id: strategicDecisions.id })
    .from(strategicDecisions)
    .where(
      and(
        eq(strategicDecisions.id, decisionId),
        eq(strategicDecisions.projectId, projectId)
      )
    )
    .limit(1);

  if (!decision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(decisionLinks)
      .where(eq(decisionLinks.decisionId, decisionId));
    if (parsed.data.links.length > 0) {
      await tx.insert(decisionLinks).values(
        parsed.data.links.map((l) => ({
          decisionId,
          entityType: l.entityType,
          entityId: l.entityId,
          role: l.role,
        }))
      );
    }
  });

  return NextResponse.json({ ok: true });
}
