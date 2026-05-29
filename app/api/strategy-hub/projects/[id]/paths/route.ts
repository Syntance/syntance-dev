import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { strategyPaths } from "@/db/schema";
import {
  requireProjectAccess,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  isDefault: z.boolean().optional(),
  orderIdx: z.number().int().optional(),
  status: z.string().max(50).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select()
    .from(strategyPaths)
    .where(and(eq(strategyPaths.projectId, id), isNull(strategyPaths.deletedAt)))
    .orderBy(asc(strategyPaths.orderIdx), asc(strategyPaths.createdAt));

  return NextResponse.json({ paths: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const [created] = await db
    .insert(strategyPaths)
    .values({ projectId: id, ...parsed.data })
    .returning();

  return NextResponse.json({ path: created }, { status: 201 });
}
