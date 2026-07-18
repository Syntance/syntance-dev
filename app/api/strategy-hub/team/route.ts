import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { getAdminRole } from "@/lib/strategy-hub/context";
import { badRequest } from "@/lib/strategy-hub/api-helpers";
import {
  TeamAccessError,
  inviteMember,
  listWorkspaceMembers,
} from "@/lib/strategy-hub/team";

const inviteSchema = z.object({ email: z.email().max(255) });

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

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return badRequest("Podaj poprawny adres email");
  }

  try {
    const member = await inviteMember(session.email, parsed.data.email);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    if (err instanceof TeamAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
