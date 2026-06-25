import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  requireProjectAccess,
  badRequest,
} from "@/lib/strategy-hub/api-helpers";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  hourlyRate: z.number().min(0).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const [updated] = await db
    .update(projects)
    .set({
      hourlyRate: parsed.data.hourlyRate,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning({
      id: projects.id,
      hourlyRate: projects.hourlyRate,
    });

  return NextResponse.json({ project: updated });
}
