import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAdminRole } from "@/lib/strategy-hub/context";
import {
  TeamAccessError,
  inviteMember,
  listWorkspaceMembers,
} from "@/lib/strategy-hub/team";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [members, role] = await Promise.all([
    listWorkspaceMembers(session.email),
    getAdminRole(session.email),
  ]);
  return NextResponse.json({ members, currentEmail: session.email, currentRole: role });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 });
  }

  try {
    const member = await inviteMember(session.email, email);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    if (err instanceof TeamAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
