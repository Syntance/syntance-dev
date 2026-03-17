import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, verifyPassword, hashPassword } from "@/lib/auth";
import { getClientByEmail, getProjectsForUser } from "@/sanity/queries";

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

  const sanityClient = await getClientByEmail(email);
  if (!sanityClient) {
    return NextResponse.json(
      { error: "Nie znaleziono konta z tym adresem email" },
      { status: 401 }
    );
  }

  const { projects } = await getProjectsForUser(email);
  if (projects.length === 0 && !sanityClient.isAdmin) {
    return NextResponse.json(
      { error: "Brak przypisanych projektów do tego konta" },
      { status: 401 }
    );
  }

  let localClient = await prisma.clientUser.findUnique({ where: { email } });

  if (!localClient || !localClient.passwordHash) {
    const sanityPassword = sanityClient.password;

    if (sanityPassword && password === sanityPassword) {
      const passwordHash = await hashPassword(password);

      if (localClient) {
        localClient = await prisma.clientUser.update({
          where: { email },
          data: {
            passwordHash,
            name: sanityClient.name || localClient.name,
          },
        });
      } else {
        localClient = await prisma.clientUser.create({
          data: {
            email,
            name: sanityClient.name,
            passwordHash,
          },
        });
      }
    } else if (sanityPassword) {
      return NextResponse.json(
        { error: "Nieprawidłowe hasło" },
        { status: 401 }
      );
    } else {
      return NextResponse.json(
        {
          error:
            "Konto nie ma ustawionego hasła. Użyj opcji 'Ustaw hasło' lub poproś admina o ustawienie hasła w Sanity.",
          code: "NO_PASSWORD",
        },
        { status: 401 }
      );
    }
  } else {
    if (!(await verifyPassword(password, localClient.passwordHash))) {
      return NextResponse.json(
        { error: "Nieprawidłowe hasło" },
        { status: 401 }
      );
    }
  }

  const token = signToken({
    userId: localClient.id,
    email: localClient.email,
    type: "client",
  });

  const response = NextResponse.json({
    success: true,
    slug: projects[0]?.slug || null,
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
