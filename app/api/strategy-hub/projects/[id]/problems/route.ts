import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businessProblems } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

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
  // Problemy to fundament (W0): czytamy z projektu-źródła, ale autoryzacja
  // została wykonana na `id` pytającego — nigdy na projekcie źródłowym.
  const foundation = await resolveFoundationSource(id);
  const readId = foundation.projectId;
  const pathId = new URL(req.url).searchParams.get("pathId");
  // Przy dziedziczeniu filtr ścieżki jest pomijany: ścieżki należą do projektu
  // pytającego, więc nie zrównają się ze ścieżkami źródła — zostałyby wyłącznie
  // problemy z `path_id IS NULL`, a reszta zniknęłaby po cichu.
  const pathFilter =
    pathId && !foundation.inherited
      ? or(eq(businessProblems.pathId, pathId), isNull(businessProblems.pathId))
      : undefined;

  const rows = await db
    .select()
    .from(businessProblems)
    .where(
      and(
        eq(businessProblems.projectId, readId),
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
  // Zapis wyłącznie do własnego fundamentu — patrz JSDoc requireOwnFoundation.
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

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
