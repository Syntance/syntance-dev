import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const localClient = await prisma.clientUser.findUnique({ where: { email } });
  if (!localClient || !localClient.passwordHash) {
    return NextResponse.json({ success: true });
  }

  const token = generateResetToken();

  await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await sendPasswordResetEmail(email, token);

  return NextResponse.json({ success: true });
}
