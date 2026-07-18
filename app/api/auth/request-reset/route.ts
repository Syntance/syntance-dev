import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/db";
import { clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateResetToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const bodySchema = z.object({ email: z.email().max(255) });

/** Endpoint wysyła maile — ciaśniejszy limit niż login (spam vector). */
const LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 });
  }
  const { email } = parsed.data;

  const rate = await checkRateLimit(
    `reset-req:${clientIp(req)}:${email.toLowerCase()}`,
    LIMIT,
    WINDOW_MS
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele prób. Spróbuj ponownie później." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const [localClient] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, email))
    .limit(1);
  if (!localClient || !localClient.passwordHash) {
    return NextResponse.json({ success: true });
  }

  const token = generateResetToken();

  await db.insert(passwordResetTokens).values({
    id: randomUUID(),
    email,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  await sendPasswordResetEmail(email, token);

  return NextResponse.json({ success: true });
}
