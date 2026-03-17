import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, verifyPassword } from "@/lib/auth";
import { getProjectsByEmail } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.type === "admin") {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i hasło są wymagane" },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane logowania" },
        { status: 401 }
      );
    }

    const token = signToken({
      adminId: admin.id,
      email: admin.email,
      type: "admin",
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email i hasło są wymagane" },
      { status: 400 }
    );
  }

  const projects = await getProjectsByEmail(email);
  if (projects.length === 0) {
    return NextResponse.json(
      { error: "Brak przypisanych projektów do tego adresu email" },
      { status: 401 }
    );
  }

  const client = await prisma.clientUser.findUnique({ where: { email } });
  if (!client || !client.passwordHash) {
    return NextResponse.json(
      {
        error: "Konto nie ma ustawionego hasła. Użyj opcji 'Ustaw hasło'.",
        code: "NO_PASSWORD",
      },
      { status: 401 }
    );
  }

  if (!(await verifyPassword(password, client.passwordHash))) {
    return NextResponse.json(
      { error: "Nieprawidłowe hasło" },
      { status: 401 }
    );
  }

  const token = signToken({
    userId: client.id,
    email: client.email,
    type: "client",
  });

  const response = NextResponse.json({
    success: true,
    slug: projects[0].slug,
  });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
