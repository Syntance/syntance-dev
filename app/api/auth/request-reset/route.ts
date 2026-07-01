import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { clientUsers, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email jest wymagany" },
      { status: 400 }
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
