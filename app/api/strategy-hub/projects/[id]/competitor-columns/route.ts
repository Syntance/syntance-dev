import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorColumns } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  requireProjectAccess,
  requireOwnFoundation,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

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

const createSchema = z
  .object({
    label: z.string().min(1).max(255),
    type: z.enum(COLUMN_TYPES),
    options: z.array(optionSchema).max(30).optional(),
    textColor: z.string().max(20).optional().nullable(),
  })
  .refine((v) => v.type !== "select" || (v.options && v.options.length > 0), {
    message: "Kolumna typu 'select' wymaga co najmniej jednej opcji",
    path: ["options"],
  });

function toKey(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "kolumna"
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  // Definicje kolumn żyją na tej samej osi co konkurenci (W0): projekt
  // dziedziczący musi widzieć te same kolumny co źródło, inaczej klucze
  // w customFields nie miałyby czym się wyświetlić.
  const { projectId: readId } = await resolveFoundationSource(id);

  const rows = await db
    .select()
    .from(competitorColumns)
    .where(
      and(
        eq(competitorColumns.projectId, readId),
        isNull(competitorColumns.deletedAt)
      )
    )
    .orderBy(asc(competitorColumns.orderIdx), asc(competitorColumns.createdAt));

  return NextResponse.json({ items: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;
  const own = await requireOwnFoundation(id);
  if (!own.ok) return own.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const existing = await db
    .select({ key: competitorColumns.key, orderIdx: competitorColumns.orderIdx })
    .from(competitorColumns)
    .where(
      and(eq(competitorColumns.projectId, id), isNull(competitorColumns.deletedAt))
    );

  const taken = new Set(existing.map((r) => r.key));
  const base = toKey(parsed.data.label);
  let key = base;
  for (let i = 2; taken.has(key); i += 1) key = `${base}_${i}`;

  const nextOrder =
    existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.orderIdx)) + 1;

  const inserted = await db
    .insert(competitorColumns)
    .values({
      projectId: id,
      key,
      label: parsed.data.label,
      type: parsed.data.type,
      options: parsed.data.type === "select" ? parsed.data.options : null,
      textColor: parsed.data.textColor ?? null,
      // Ten route tworzy WYŁĄCZNIE kolumny własne — systemowe (Typ, Lokalizacja…)
      // są seedowane raz migracją, nigdy przez API.
      source: "custom",
      orderIdx: nextOrder,
    })
    .returning();

  return NextResponse.json({ item: inserted[0] }, { status: 201 });
}
