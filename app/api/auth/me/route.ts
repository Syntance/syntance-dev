import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (session.type === "admin") {
    const name = session.email === process.env.DEMO_EMAIL ? "Demo" : session.email.split("@")[0];
    return NextResponse.json({ user: { email: session.email, name, role: "owner" } });
  }

  return NextResponse.json({
    user: { email: session.email, name: session.email.split("@")[0], role: "client" },
  });
}
