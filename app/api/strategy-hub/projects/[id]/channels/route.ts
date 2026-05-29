import { NextRequest, NextResponse } from "next/server";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { z } from "zod";

const channelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.string().optional(),
  icon: z.string().optional(),
  costMonthly: z.number().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getStrategyHubAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const pathId = new URL(req.url).searchParams.get("pathId");

  const pathFilter = pathId
    ? or(eq(channels.pathId, pathId), isNull(channels.pathId))
    : undefined;

  const rows = await db
    .select()
    .from(channels)
    .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt), pathFilter));

  return NextResponse.json({ channels: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getStrategyHubAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json();
  const parsed = channelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  if (id) {
    const [updated] = await db
      .update(channels)
      .set({ ...data })
      .where(and(eq(channels.id, id), eq(channels.projectId, projectId)))
      .returning();
    return NextResponse.json({ channel: updated });
  }

  const [created] = await db
    .insert(channels)
    .values({ projectId, ...data })
    .returning();

  return NextResponse.json({ channel: created }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getStrategyHubAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  await db
    .update(channels)
    .set({ deletedAt: new Date() })
    .where(and(eq(channels.id, channelId), eq(channels.projectId, projectId)));

  return NextResponse.json({ ok: true });
}
