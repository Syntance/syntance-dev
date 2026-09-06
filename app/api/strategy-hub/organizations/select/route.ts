import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ORG_COOKIE,
  getOrganizationRole,
} from "@/lib/strategy-hub/context";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const selectSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Wybór bieżącej organizacji (selektor w sidebarze).
 *
 * Ciasteczko ustawiamy WYŁĄCZNIE po potwierdzeniu członkostwa — inaczej byłby
 * to samoobsługowy sposób na wskazanie cudzej organizacji. Samo ciasteczko i tak
 * jest przy odczycie weryfikowane ponownie (`getCurrentOrganizationForAdmin`),
 * więc to druga warstwa, nie jedyna.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const parsed = selectSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const role = await getOrganizationRole(
    auth.access.session.email,
    parsed.data.organizationId
  );
  if (!role) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, organizationId: parsed.data.organizationId });
  res.cookies.set(ORG_COOKIE, parsed.data.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
