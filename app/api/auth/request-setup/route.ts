import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { generateResetToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendPasswordSetupEmail } from "@/lib/email";
import { getClientAccessSummary } from "@/lib/client-portal/queries";

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
    `setup-req:${clientIp(req)}:${email.toLowerCase()}`,
    LIMIT,
    WINDOW_MS
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele prób. Spróbuj ponownie później." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const summary = await getClientAccessSummary(email);
  if (!summary.isKnownClient) {
    // Nie ujawniamy, czy e-mail istnieje w systemie.
    return NextResponse.json({ success: true });
  }

  if (summary.hasPassword) {
    return NextResponse.json(
      {
        error:
          "Konto ma już ustawione hasło. Użyj 'Zapomniałem hasła', jeśli chcesz je zresetować.",
        code: "HAS_PASSWORD",
      },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, email))
    .limit(1);
  if (!existing) {
    await db.insert(clientUsers).values({
      id: randomUUID(),
      email,
      name: summary.name,
      updatedAt: new Date(),
    });
  }

  const token = generateResetToken();
  await db.insert(passwordResetTokens).values({
    id: randomUUID(),
    email,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendPasswordSetupEmail(email, token);

  return NextResponse.json({ success: true });
}
