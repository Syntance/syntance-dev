import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { getProjectsByEmail } from "@/sanity/queries";

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { message, projectSlug } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Wiadomość nie może być pusta" },
      { status: 400 }
    );
  }

  let slug = projectSlug;
  if (!slug) {
    const projects = await getProjectsByEmail(session.email);
    slug = projects[0]?.slug;
  }

  if (!slug) {
    return NextResponse.json(
      { error: "Nie znaleziono projektu" },
      { status: 400 }
    );
  }

  const feedback = await prisma.feedback.create({
    data: {
      projectSlug: slug,
      email: session.email,
      message: message.trim(),
    },
  });

  return NextResponse.json(feedback, { status: 201 });
}

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const projects = await getProjectsByEmail(session.email);
  const slugs = projects.map((p) => p.slug);

  const feedbacks = await prisma.feedback.findMany({
    where: { projectSlug: { in: slugs } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(feedbacks);
}
