import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { objections } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const STAGES = ["TOFU", "MOFU", "BOFU", "retention"] as const;
const STATUSES = ["active", "resolved", "needs_proof"] as const;

const createSchema = z.object({
  objectionMd: z.string().min(1),
  pathId: z.string().uuid().optional().nullable(),
  responseMd: z.string().optional().nullable(),
  proofMd: z.string().optional().nullable(),
  segmentId: z.string().uuid().optional().nullable(),
  stage: z.enum(STAGES).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  orderIdx: z.number().int().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const pathId = new URL(req.url).searchParams.get("pathId");
  const pathFilter = pathId
    ? or(eq(objections.pathId, pathId), isNull(objections.pathId))
    : undefined;

  const rows = await db
    .select()
    .from(objections)
    .where(
      and(
        eq(objections.projectId, id),
        isNull(objections.deletedAt),
        pathFilter
      )
    )
    .orderBy(asc(objections.orderIdx), asc(objections.createdAt));

  return NextResponse.json({ items: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const inserted = await db
    .insert(objections)
    .values({
      projectId: id,
      ...parsed.data,
      source: "hub",
    })
    .returning();

  return NextResponse.json({ item: inserted[0] }, { status: 201 });
}
