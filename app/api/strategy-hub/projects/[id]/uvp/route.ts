import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uvp } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

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
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  // UVP to fundament (W0): czytamy z projektu-źródła, ale autoryzacja
  // została wykonana na `id` pytającego — nigdy na projekcie źródłowym.
  const readId = (await resolveFoundationSource(id)).projectId;

  const rows = await db
    .select()
    .from(uvp)
    .where(eq(uvp.projectId, readId))
    .limit(1);
  return NextResponse.json({ item: rows[0] ?? null });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  // Zapis wyłącznie do własnego fundamentu — patrz JSDoc requireOwnFoundation.
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

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
