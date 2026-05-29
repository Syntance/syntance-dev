import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getAuditChild } from "@/lib/strategy-hub/entities/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string; child: string }> }
) {
  const { id, auditId, child } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getAuditChild(child);
  if (!entity) return notFound("Entity");
  return NextResponse.json({ items: await entity.list(auditId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string; child: string }> }
) {
  const { id, auditId, child } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const entity = getAuditChild(child);
  if (!entity) return notFound("Entity");

  const parsed = entity.createSchema.safeParse(await req.json());
  if (!parsed.success)
    return badRequest("Invalid input", parsed.error.flatten());

  const item = await entity.create(auditId, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
