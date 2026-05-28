import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businessProblems } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const createSchema = z.object({
  problemMd: z.string().min(1),
  ambitionMd: z.string().optional().nullable(),
  ourSolutionMd: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(3).optional(),
  orderIdx: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const rows = await db
    .select()
    .from(businessProblems)
    .where(
      and(
        eq(businessProblems.projectId, id),
        isNull(businessProblems.deletedAt)
      )
    )
    .orderBy(asc(businessProblems.orderIdx), asc(businessProblems.createdAt));

  return NextResponse.json({ items: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

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
