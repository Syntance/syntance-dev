import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uvp } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const differentiatorSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
});

const patchSchema = z.object({
  coreUvpMd: z.string().optional().nullable(),
  /** JSON-string serializowanej listy StrategyListItem[] (text/note/weight). */
  valueAddsJson: z.string().optional().nullable(),
  differentiators: z.array(differentiatorSchema).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const rows = await db.select().from(uvp).where(eq(uvp.projectId, id)).limit(1);
  return NextResponse.json({ item: rows[0] ?? null });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(data).length === 0) return badRequest("No fields to update");

  const result = await db
    .insert(uvp)
    .values({ projectId: id, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: uvp.projectId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ item: result[0] });
}
