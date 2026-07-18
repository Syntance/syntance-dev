import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminUsers, clientUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  signToken,
  verifyPassword,
  sessionCookieOptions,
  DUMMY_PASSWORD_HASH,
} from "@/lib/auth";
import { checkRateLimit, resetRateLimit, clientIp } from "@/lib/rate-limit";
import { getProjectsForUser } from "@/lib/client-portal/queries";

const bodySchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(200),
  /** "admin" = zakładka logowania agencji; pomija ścieżkę klienta portalu. */
  type: z.string().optional(),
});

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Jeden komunikat dla "brak konta" i "złe hasło" — bez enumeracji kont. */
const INVALID_CREDENTIALS = "Nieprawidłowy email lub hasło";

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email i hasło są wymagane" },
      { status: 400 }
    );
  }
  const { email, password, type } = parsed.data;

  const rateKey = `login:${clientIp(req)}:${email.toLowerCase()}`;
  const rate = await checkRateLimit(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele prób logowania. Spróbuj ponownie później." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (admin && (await verifyPassword(password, admin.passwordHash))) {
    await resetRateLimit(rateKey);
    const token = signToken({
      adminId: admin.id,
      email: admin.email,
      type: "admin",
    });
    const response = NextResponse.json({
      success: true,
      isAdmin: type !== "admin" ? true : undefined,
    });
    response.cookies.set("session", token, sessionCookieOptions());
    return response;
  }

  if (type === "admin") {
    // Wyrównanie czasu: bcrypt liczy się też dla nieistniejącego konta.
    if (!admin) await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const [localClient] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, email))
    .limit(1);

  if (!localClient) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
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
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const { projects: accessible } = await getProjectsForUser(email);
  if (accessible.length === 0) {
    return NextResponse.json(
      { error: "Brak przypisanych projektów do tego konta" },
      { status: 401 }
    );
  }

  await resetRateLimit(rateKey);
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
  response.cookies.set("session", token, sessionCookieOptions());
  return response;
}
