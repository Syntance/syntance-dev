import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { getProjectsByEmail } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email jest wymagany" },
      { status: 400 }
    );
  }

  const client = await prisma.clientUser.findUnique({ where: { email } });
  if (!client || !client.passwordHash) {
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

  const projects = await getProjectsByEmail(email);
  await sendPasswordResetEmail(email, token, projects[0]?.slug);

  return NextResponse.json({ success: true });
}
