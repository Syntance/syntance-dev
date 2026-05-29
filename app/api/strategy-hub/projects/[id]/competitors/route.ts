import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const TYPES = ["direct", "indirect", "none"] as const;
const coord = z.number().min(-1).max(1);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  pathId: z.string().uuid().optional().nullable(),
  url: z.string().url().optional().nullable(),
  type: z.enum(TYPES).optional(),
  segmentId: z.string().uuid().optional().nullable(),
  strengthsMd: z.string().optional().nullable(),
  weaknessesMd: z.string().optional().nullable(),
  pricingMd: z.string().optional().nullable(),
  channelsMd: z.string().optional().nullable(),
  notesMd: z.string().optional().nullable(),
  quadrantX: coord.optional().nullable(),
  quadrantY: coord.optional().nullable(),
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
    ? or(eq(competitors.pathId, pathId), isNull(competitors.pathId))
    : undefined;

  const rows = await db
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.projectId, id),
        isNull(competitors.deletedAt),
        pathFilter
      )
    )
    .orderBy(asc(competitors.createdAt));

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
    .insert(competitors)
    .values({
      projectId: id,
      ...parsed.data,
      source: "hub",
    })
    .returning();

  return NextResponse.json({ item: inserted[0] }, { status: 201 });
}
