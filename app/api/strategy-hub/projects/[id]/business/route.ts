import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businessStrategy, projects as projectsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendStrategyUpdatedEmail } from "@/lib/email";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { getProjectClients } from "@/sanity/queries";

const patchSchema = z.object({
  goalsMd: z.string().optional(),
  uvpMd: z.string().optional(),
  competitorsMd: z.string().optional(),
  objectionsMd: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .insert(businessStrategy)
    .values({ projectId: id, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: businessStrategy.projectId,
      set: { ...data, updatedAt: new Date() },
    });

  notifyClients(id, Object.keys(data).join(", ")).catch((err) =>
    console.error("notifyClients", err)
  );

  return NextResponse.json({ ok: true });
}

async function notifyClients(projectId: string, section: string) {
  const session = await getStrategyHubAccess();
  const projectRows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  const project = projectRows[0];
  if (!project) return;

  let clients: { email: string }[] = [];
  try {
    clients = await getProjectClients(project.slug);
  } catch (err) {
    console.warn("getProjectClients failed", err);
    return;
  }

  for (const client of clients) {
    await sendStrategyUpdatedEmail({
      to: client.email,
      projectName: project.name,
      projectSlug: project.slug,
      section,
      changedBy: session?.session.email,
    });
  }
}
