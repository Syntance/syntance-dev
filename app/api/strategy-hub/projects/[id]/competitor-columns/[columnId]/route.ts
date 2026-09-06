import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorColumns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  requireProjectAccess,
  requireOwnFoundation,
  notFound,
} from "@/lib/strategy-hub/api-helpers";

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
