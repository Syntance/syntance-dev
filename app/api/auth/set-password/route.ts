import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { getProjectsByEmail } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token i hasło są wymagane" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Hasło musi mieć minimum 8 znaków" },
      { status: 400 }
    );
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Link wygasł lub jest nieprawidłowy. Spróbuj ponownie." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { used: true },
  });

  let client = await prisma.clientUser.findUnique({
    where: { email: resetToken.email },
  });

  if (!client) {
    client = await prisma.clientUser.create({
      data: {
        email: resetToken.email,
        passwordHash,
      },
    });
  } else {
    client = await prisma.clientUser.update({
      where: { email: resetToken.email },
      data: { passwordHash },
    });
  }

  const projects = await getProjectsByEmail(client.email);

  const sessionToken = signToken({
    userId: client.id,
    email: client.email,
    type: "client",
  });

  const response = NextResponse.json({
    success: true,
    slug: projects[0]?.slug,
  });
  response.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
