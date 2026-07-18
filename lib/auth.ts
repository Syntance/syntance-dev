import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Fail-closed jak `isCronAuthorized`: brak `JWT_SECRET` na produkcji = twardy
 * błąd przy pierwszym sign/verify, nigdy znany fallback (podpisywalny przez
 * każdego). Lokalnie stały sekret dev — wygodne, bo sesje przeżywają restart.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET jest wymagany na produkcji");
  }
  return "dev-only-secret";
}

/**
 * Jedno źródło opcji cookie sesji (login, demo, set/reset-password).
 */
export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

/**
 * Hash-wabik do wyrównania czasu odpowiedzi, gdy konto nie istnieje —
 * bez niego różnica czasu (bcrypt vs brak bcrypt) zdradza istnienie konta.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$yBK6IBV/VMVoQeMsyUi0/eonjQIyvX0wS.6x8sDXKaWp7ZjPti2F2";

export interface ClientPayload {
  userId: string;
  email: string;
  type: "client";
}

export interface AdminPayload {
  adminId: string;
  email: string;
  type: "admin";
}

type TokenPayload = ClientPayload | AdminPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getClientSession(): Promise<ClientPayload | null> {
  const session = await getSession();
  if (!session || session.type !== "client") return null;
  return session;
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const session = await getSession();
  if (!session || session.type !== "admin") return null;
  return session;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
