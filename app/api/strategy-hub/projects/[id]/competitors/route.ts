import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const TYPES = ["direct", "indirect", "none"] as const;
const coord = z.number().min(-1).max(1);

const createSchema = z.object({
  name: z.string().min(1).max(255),
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const rows = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.projectId, id), isNull(competitors.deletedAt)))
    .orderBy(asc(competitors.createdAt));

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
    .insert(competitors)
    .values({
      projectId: id,
      ...parsed.data,
      source: "hub",
    })
    .returning();

  return NextResponse.json({ item: inserted[0] }, { status: 201 });
}
