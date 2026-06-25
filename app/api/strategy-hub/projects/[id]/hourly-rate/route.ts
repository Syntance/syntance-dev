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
  hourlyRateDevelopment: z.number().min(0).nullable().optional(),
  hourlyRateMaintenance: z.number().min(0).nullable().optional(),
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

  if (
    parsed.data.hourlyRateDevelopment === undefined &&
    parsed.data.hourlyRateMaintenance === undefined
  ) {
    return badRequest("Podaj co najmniej jedną stawkę.");
  }

  const [updated] = await db
    .update(projects)
    .set({
      ...(parsed.data.hourlyRateDevelopment !== undefined
        ? { hourlyRateDevelopment: parsed.data.hourlyRateDevelopment }
        : {}),
      ...(parsed.data.hourlyRateMaintenance !== undefined
        ? { hourlyRateMaintenance: parsed.data.hourlyRateMaintenance }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning({
      id: projects.id,
      hourlyRateDevelopment: projects.hourlyRateDevelopment,
      hourlyRateMaintenance: projects.hourlyRateMaintenance,
    });

  return NextResponse.json({ project: updated });
}
