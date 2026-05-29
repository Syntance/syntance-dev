import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businessProblems } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const createSchema = z.object({
  problemMd: z.string().min(1),
  pathId: z.string().uuid().optional().nullable(),
  ambitionMd: z.string().optional().nullable(),
  ourSolutionMd: z.string().optional().nullable(),
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
    ? or(eq(businessProblems.pathId, pathId), isNull(businessProblems.pathId))
    : undefined;

  const rows = await db
    .select()
    .from(businessProblems)
    .where(
      and(
        eq(businessProblems.projectId, id),
        isNull(businessProblems.deletedAt),
        pathFilter
      )
    )
    .orderBy(asc(businessProblems.orderIdx), asc(businessProblems.createdAt));

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
    .insert(businessProblems)
    .values({
      projectId: id,
      ...parsed.data,
      source: "hub",
    })
    .returning();

  return NextResponse.json({ item: inserted[0] }, { status: 201 });
}
