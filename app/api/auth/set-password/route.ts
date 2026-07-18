import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminUsers, clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hashPassword, signToken, sessionCookieOptions } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getProjectsForUser } from "@/lib/client-portal/queries";

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  password: z
    .string()
    .min(8, "Hasło musi mieć minimum 8 znaków")
    .max(200),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Token i hasło są wymagane";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { token, password } = parsed.data;

  // Limit per IP — utrudnia zgadywanie tokenów setup/invite.
  const rate = await checkRateLimit(
    `set-pw:${clientIp(req)}`,
    10,
    15 * 60 * 1000
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele prób. Spróbuj ponownie później." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Link wygasł lub jest nieprawidłowy. Spróbuj ponownie." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.id, resetToken.id));

  // Zaproszenie do zespołu agencji (Faza 17) — osobna gałąź, bo docelowe konto
  // to AdminUser, a sesja to token typu "admin", nie "client".
  if (resetToken.purpose === "admin_invite") {
    const [admin] = await db
      .update(adminUsers)
      .set({ passwordHash })
      .where(eq(adminUsers.email, resetToken.email))
      .returning();

    if (!admin) {
      return NextResponse.json(
        { error: "Nie znaleziono zaproszonego konta." },
        { status: 400 }
      );
    }

    const sessionToken = signToken({
      adminId: admin.id,
      email: admin.email,
      type: "admin",
    });

    const response = NextResponse.json({ success: true, admin: true });
    response.cookies.set("session", sessionToken, sessionCookieOptions());
    return response;
  }

  const [existing] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, resetToken.email))
    .limit(1);

  const client = existing
    ? (
        await db
          .update(clientUsers)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(clientUsers.email, resetToken.email))
          .returning()
      )[0]
    : (
        await db
          .insert(clientUsers)
          .values({ id: randomUUID(), email: resetToken.email, passwordHash, updatedAt: new Date() })
          .returning()
      )[0];

  const { projects: accessible } = await getProjectsForUser(client.email);

  const sessionToken = signToken({
    userId: client.id,
    email: client.email,
    type: "client",
  });

  const response = NextResponse.json({
    success: true,
    slug: accessible[0]?.slug,
  });
  response.cookies.set("session", sessionToken, sessionCookieOptions());
  return response;
}
