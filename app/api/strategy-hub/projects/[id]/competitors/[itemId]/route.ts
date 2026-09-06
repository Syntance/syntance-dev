import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

const TYPES = ["direct", "indirect", "none"] as const;
const PRICE_COMPARISONS = ["cheaper", "similar", "more_expensive"] as const;
const coord = z.number().min(-1).max(1);

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
  /**
   * Wartości kolumn użytkownika, TYLKO te które się zmieniają — merge, nie
   * nadpisanie całego obiektu (patrz PATCH). Walidacja celowo luźna: typ
   * wartości zależy od `competitorColumns.type`, którego nie znamy tutaj bez
   * dodatkowego zapytania — ten sam kompromis co przy innych JSONB w repo
   * (marketData/scoring/dimensions).
   */
  customFields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  // Bez tej bramki edycja konkurenta z fundamentu dziedziczonego kończy się
  // mylącym 404 (rekord należy do przodka) zamiast czytelnym 409.
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const { customFields, ...rest } = parsed.data;
  const data = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(data).length === 0 && customFields === undefined) {
    return badRequest("No fields to update");
  }

  // MERGE, nie zastąpienie: klient wysyła tylko zmienione klucze (zwykle
  // jeden — edycja pojedynczej komórki), więc `SET` musiałby najpierw znać
  // resztę obiektu. `||` w Postgresie łączy JSONB bez round-tripu po stare dane.
  const customFieldsUpdate =
    customFields !== undefined
      ? sql`coalesce(${competitors.customFields}, '{}'::jsonb) || ${JSON.stringify(customFields)}::jsonb`
      : undefined;

  const updated = await db
    .update(competitors)
    .set({
      ...data,
      ...(customFieldsUpdate !== undefined
        ? { customFields: customFieldsUpdate }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(competitors.id, itemId), eq(competitors.projectId, id)))
    .returning();

  if (!updated[0]) return notFound("Competitor");
  return NextResponse.json({ item: updated[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

  const updated = await db
    .update(competitors)
    .set({ deletedAt: new Date() })
    .where(and(eq(competitors.id, itemId), eq(competitors.projectId, id)))
    .returning({ id: competitors.id });

  if (!updated[0]) return notFound("Competitor");
  return NextResponse.json({ ok: true });
}
