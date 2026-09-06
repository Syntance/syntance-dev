import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

const TYPES = ["direct", "indirect", "none"] as const;
const PRICE_COMPARISONS = ["cheaper", "similar", "more_expensive"] as const;
const coord = z.number().min(-1).max(1);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  pathId: z.string().uuid().optional().nullable(),
  url: z.string().url().optional().nullable(),
  type: z.enum(TYPES).optional(),
  segmentId: z.string().uuid().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  specialization: z.string().max(255).optional().nullable(),
  strengthsMd: z.string().optional().nullable(),
  weaknessesMd: z.string().optional().nullable(),
  pricingMd: z.string().optional().nullable(),
  channelsMd: z.string().optional().nullable(),
  notesMd: z.string().optional().nullable(),
  ourEdgeMd: z.string().optional().nullable(),
  priceComparison: z.enum(PRICE_COMPARISONS).optional().nullable(),
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
  // Konkurencja to fundament (W0): czytamy z projektu-źródła, ale autoryzacja
  // została wykonana na `id` pytającego — nigdy na projekcie źródłowym.
  const foundation = await resolveFoundationSource(id);
  const readId = foundation.projectId;
  const pathId = new URL(req.url).searchParams.get("pathId");
  // Przy dziedziczeniu filtr ścieżki jest pomijany: ścieżki należą do projektu
  // pytającego, więc nie zrównają się ze ścieżkami źródła — zostaliby wyłącznie
  // konkurenci z `path_id IS NULL`, a reszta zniknęłaby po cichu.
  const pathFilter =
    pathId && !foundation.inherited
      ? or(eq(competitors.pathId, pathId), isNull(competitors.pathId))
      : undefined;

  const rows = await db
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.projectId, readId),
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
  // Zapis wyłącznie do własnego fundamentu — patrz JSDoc requireOwnFoundation.
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

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
