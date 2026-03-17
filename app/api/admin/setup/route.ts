import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const existingAdmin = await prisma.adminUser.findFirst();
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

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
    },
  });

  return NextResponse.json(
    { success: true, id: admin.id, email: admin.email },
    { status: 201 }
  );
}
