import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordSetupEmail } from "@/lib/email";
import { getProjectsByEmail } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email jest wymagany" },
      { status: 400 }
    );
  }

  const projects = await getProjectsByEmail(email);
  if (projects.length === 0) {
    return NextResponse.json({ success: true });
  }

  let client = await prisma.clientUser.findUnique({ where: { email } });

  if (!client) {
    client = await prisma.clientUser.create({
      data: {
        email,
        name: projects[0].clientName,
      },
    });
  }

  if (client.passwordHash) {
    return NextResponse.json(
      {
        error: "Konto ma już ustawione hasło. Użyj 'Zapomniałem hasła', jeśli chcesz je zresetować.",
        code: "HAS_PASSWORD",
      },
      { status: 400 }
    );
  }

  const token = generateResetToken();

  await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendPasswordSetupEmail(email, token, projects[0]?.slug);

  return NextResponse.json({ success: true });
}
