import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorColumns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

const COLUMN_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "url",
  "checkbox",
  "select",
] as const;

const optionSchema = z.object({
  value: z.string().min(1).max(60),
  label: z.string().min(1).max(100),
  color: z.string().min(1).max(30),
});

/**
 * `type`/`options` razem: formularz edycji zawsze wysyła oba pola naraz
 * (patrz `ColumnFormDialog`), więc refine widzi kompletny obraz. Osobny,
 * węższy patch `{ orderIdx }` (przesuwanie) ma `type` nieustawione — refine
 * przechodzi trywialnie, bo `undefined !== "select"`.
 */
const patchSchema = z
  .object({
    label: z.string().min(1).max(255).optional(),
    type: z.enum(COLUMN_TYPES).optional(),
    options: z.array(optionSchema).max(30).optional().nullable(),
    textColor: z.string().max(20).optional().nullable(),
    orderIdx: z.number().int().min(0).optional(),
  })
  .refine((v) => v.type !== "select" || (v.options && v.options.length > 0), {
    message: "Kolumna typu 'select' wymaga co najmniej jednej opcji",
    path: ["options"],
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const { id, columnId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const [target] = await db
    .select({ source: competitorColumns.source })
    .from(competitorColumns)
    .where(
      and(eq(competitorColumns.id, columnId), eq(competitorColumns.projectId, id))
    )
    .limit(1);
  if (!target) return notFound("Column");

  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  // Kolumna systemowa reprezentuje prawdziwą, typowaną kolumnę SQL — jej typ
  // i opcje są strukturalnie zablokowane niezależnie od tego, co wysłał klient.
  // UI nigdy tego nie wysyła, ale serwer jest tu ostatnią linią obrony.
  if (target.source === "system") {
    delete data.type;
    delete data.options;
  } else if (data.type && data.type !== "select") {
    // Kolumna własna: zmiana typu na coś innego niż 'select' czyści stare
    // opcje — inaczej zostałyby osierocone (kolumna 'text' z martwym options).
    data.options = null;
  }

  if (Object.keys(data).length === 0) return badRequest("No fields to update");

  const updated = await db
    .update(competitorColumns)
    .set(data)
    .where(
      and(eq(competitorColumns.id, columnId), eq(competitorColumns.projectId, id))
    )
    .returning();

  if (!updated[0]) return notFound("Column");
  return NextResponse.json({ item: updated[0] });
}

/**
 * Usuwa definicję kolumny. Wartości pod jej `key` zostają nietknięte w
 * `competitors.custom_fields` innych wierszy — JSONB nie wymusza integralności
 * referencyjnej, a UI po prostu przestaje renderować klucz, którego nie zna.
 * Odtworzenie kolumny o tej samej etykiecie dostanie nowy `key` (sufiks),
 * więc stare wartości nie "wskoczą" z powrotem przez pomyłkę.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const { id, columnId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

  const [target] = await db
    .select({ source: competitorColumns.source })
    .from(competitorColumns)
    .where(
      and(eq(competitorColumns.id, columnId), eq(competitorColumns.projectId, id))
    )
    .limit(1);
  if (!target) return notFound("Column");

  // Systemowa kolumna reprezentuje prawdziwe dane (competitors.location itd.)
  // — "usunięcie" niczego by nie skasowało, tylko ukryło pole w mylący sposób.
  if (target.source === "system") {
    return badRequest("System columns cannot be deleted");
  }

  const updated = await db
    .update(competitorColumns)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(competitorColumns.id, columnId), eq(competitorColumns.projectId, id))
    )
    .returning({ id: competitorColumns.id });

  if (!updated[0]) return notFound("Column");
  return NextResponse.json({ ok: true });
}
