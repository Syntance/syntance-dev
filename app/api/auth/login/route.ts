import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminUsers, clientUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signToken, verifyPassword } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/client-portal/queries";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email i hasło są wymagane" },
      { status: 400 }
    );
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (admin && (await verifyPassword(password, admin.passwordHash))) {
    const token = signToken({
      adminId: admin.id,
      email: admin.email,
      type: "admin",
    });
    const response = NextResponse.json({
      success: true,
      isAdmin: body.type !== "admin" ? true : undefined,
    });
    response.cookies.set("session", token, COOKIE_OPTIONS);
    return response;
  }

  if (body.type === "admin") {
    return NextResponse.json(
      { error: "Nieprawidłowe dane logowania" },
      { status: 401 }
    );
  }

  const [localClient] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, email))
    .limit(1);

  if (!localClient) {
    return NextResponse.json(
      { error: "Nie znaleziono konta z tym adresem email" },
      { status: 401 }
    );
  }

  if (!localClient.passwordHash) {
    return NextResponse.json(
      {
        error:
          "Konto nie ma jeszcze ustawionego hasła. Użyj opcji 'Ustaw hasło'.",
        code: "NO_PASSWORD",
      },
      { status: 401 }
    );
  }

  if (!(await verifyPassword(password, localClient.passwordHash))) {
    return NextResponse.json(
      { error: "Nieprawidłowe hasło" },
      { status: 401 }
    );
  }

  const { projects: accessible } = await getProjectsForUser(email);
  if (accessible.length === 0) {
    return NextResponse.json(
      { error: "Brak przypisanych projektów do tego konta" },
      { status: 401 }
    );
  }

  const token = signToken({
    userId: localClient.id,
    email: localClient.email,
    type: "client",
  });

  const response = NextResponse.json({
    success: true,
    slug: accessible[0]?.slug ?? null,
    isAdmin: false,
  });
  response.cookies.set("session", token, COOKIE_OPTIONS);
  return response;
}
