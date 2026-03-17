import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
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
