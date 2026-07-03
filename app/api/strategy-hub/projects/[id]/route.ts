import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const { project } = auth;
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      icon: project.icon,
    },
  });
}

/**
 * Archiwizacja projektu (soft-delete). Bez kaskady na encje — wszystkie
 * odczyty i tak filtrują po `projectId`, więc dane zostają nietknięte
 * i projekt można odtworzyć przez `deletedAt = NULL` (F1, plan naprawy 07).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  await db
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(eq(projects.id, id));

  return NextResponse.json({ ok: true });
}
