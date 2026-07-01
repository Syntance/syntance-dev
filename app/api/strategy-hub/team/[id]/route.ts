import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { TeamAccessError, removeMember } from "@/lib/strategy-hub/team";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await removeMember(session.email, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeamAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
