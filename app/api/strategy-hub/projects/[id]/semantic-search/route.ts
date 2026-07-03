import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { searchSimilar } from "@/lib/strategy-hub/embeddings/search";
import { entityRefSchema } from "@/lib/strategy-hub/relations/schemas";

const bodySchema = z
  .object({
    query: z.string().min(1).max(4000).optional(),
    entityRef: entityRefSchema.optional(),
    k: z.number().int().min(1).max(50).optional(),
  })
  .refine(
    (d) =>
      (d.query !== undefined && d.entityRef === undefined) ||
      (d.query === undefined && d.entityRef !== undefined),
    { message: "Podaj dokładnie query LUB entityRef" }
  );

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const results = await searchSimilar(projectId, parsed.data);
  return NextResponse.json({ results });
}
