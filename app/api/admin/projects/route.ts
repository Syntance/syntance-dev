import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAllProjects } from "@/sanity/queries";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const projects = await getAllProjects();
  return NextResponse.json(projects);
}
