import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentOrganizationOrNull } from "@/lib/strategy-hub/context";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (session.type === "admin") {
    const name =
      session.email === process.env.DEMO_EMAIL
        ? "Demo"
        : session.email.split("@")[0];

    // Rola jest rolą W BIEŻĄCEJ ORGANIZACJI, nie globalną — wcześniej zwracaliśmy
    // tu na sztywno "owner", przez co członek widział o sobie w sidebarze
    // uprawnienia, których nie ma. Odczyt celowo nie tworzy organizacji
    // (`…OrNull`), bo to endpoint odpytywany przy każdym renderze powłoki.
    const biezaca = await getCurrentOrganizationOrNull(session.email);

    return NextResponse.json({
      user: {
        email: session.email,
        name,
        role: biezaca?.role ?? "member",
        organization: biezaca
          ? { id: biezaca.organization.id, name: biezaca.organization.name }
          : null,
      },
    });
  }

  return NextResponse.json({
    user: { email: session.email, name: session.email.split("@")[0], role: "client" },
  });
}
