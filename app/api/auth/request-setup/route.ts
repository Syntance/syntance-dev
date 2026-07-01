import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordSetupEmail } from "@/lib/email";
import { getClientAccessSummary } from "@/lib/client-portal/queries";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email jest wymagany" },
      { status: 400 }
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
