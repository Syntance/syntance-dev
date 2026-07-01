import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json(
      { error: "Setup nie jest skonfigurowany" },
      { status: 500 }
    );
  }

  const body = await req.json();
  if (body.setupToken !== setupToken) {
    return NextResponse.json(
      { error: "Nieprawidłowy token setup" },
      { status: 401 }
    );
  }

  const [existingAdmin] = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  if (existingAdmin) {
    return NextResponse.json(
      { error: "Admin już istnieje" },
      { status: 409 }
    );
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email i hasło są wymagane" },
      { status: 400 }
    );
  }

  const [admin] = await db
    .insert(adminUsers)
    .values({ id: randomUUID(), email, passwordHash: await hashPassword(password) })
    .returning();

  return NextResponse.json(
    { success: true, id: admin.id, email: admin.email },
    { status: 201 }
  );
}
