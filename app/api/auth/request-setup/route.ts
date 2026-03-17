import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordSetupEmail } from "@/lib/email";
import { getClientByEmail, getProjectsForUser } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email jest wymagany" },
      { status: 400 }
    );
  }

  const sanityClient = await getClientByEmail(email);
  if (!sanityClient) {
    return NextResponse.json({ success: true });
  }

  let localClient = await prisma.clientUser.findUnique({ where: { email } });

  if (!localClient) {
    localClient = await prisma.clientUser.create({
      data: {
        email,
        name: sanityClient.name,
      },
    });
  }

  if (localClient.passwordHash) {
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

  const { projects } = await getProjectsForUser(email);
  await sendPasswordSetupEmail(email, token, projects[0]?.slug);

  return NextResponse.json({ success: true });
}
