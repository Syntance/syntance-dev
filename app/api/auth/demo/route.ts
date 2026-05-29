import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";

/**
 * Endpoint demo logowania — dostępny tylko gdy DEMO_EMAIL + DEMO_PASSWORD są ustawione.
 * Nie wymaga podania hasła od klienta: weryfikacja odbywa się wyłącznie server-side.
 * Używany przez przycisk "Wypróbuj demo" na stronie logowania.
 */
export async function POST() {
  const demoEmail = process.env.DEMO_EMAIL;
  const demoPassword = process.env.DEMO_PASSWORD;

  if (!demoEmail || !demoPassword) {
    return NextResponse.json(
      { error: "Demo nie jest skonfigurowane" },
      { status: 404 }
    );
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: demoEmail } });

  if (!admin || !(await verifyPassword(demoPassword, admin.passwordHash))) {
    return NextResponse.json(
      { error: "Błąd konfiguracji konta demo" },
      { status: 500 }
    );
  }

  const token = signToken({
    adminId: admin.id,
    email: admin.email,
    type: "admin",
  });

  const response = NextResponse.json({ success: true, isAdmin: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 4, // 4h — wystarczy na prezentację
    path: "/",
  });
  return response;
}
