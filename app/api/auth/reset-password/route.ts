import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  // Limit per IP — utrudnia zgadywanie tokenów resetu.
  const rate = await checkRateLimit(
    `reset-pw:${clientIp(req)}`,
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

  const [client] = await db
    .update(clientUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(clientUsers.email, resetToken.email))
    .returning();

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
