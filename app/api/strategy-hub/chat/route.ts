import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireApiAccess } from "@/lib/strategy-hub/api-helpers";
import { buildChatTools } from "@/lib/strategy-hub/ai-tools";
import { buildWriteTools } from "@/lib/strategy-hub/ai-tools-write";
import { buildGraphTools } from "@/lib/strategy-hub/ai-tools-graph";

export const maxDuration = 60;

const MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
] as const;

const bodySchema = z.object({
  projectId: z.string().uuid(),
  messages: z.array(z.any()).min(1),
  model: z.enum(MODELS).default("claude-sonnet-4-5"),
  tools: z
    .object({
      webSearch: z.boolean().default(false),
      notionRead: z.boolean().default(false),
    })
    .default({ webSearch: false, notionRead: false }),
  aiRules: z.string().max(2000).optional().default(""),
});

export async function POST(req: Request) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;
  const { access } = auth;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY nie jest ustawiony. Dodaj go do zmiennych środowiskowych.",
      },
      { status: 500 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const { projectId, messages, model, tools, aiRules } = body;
  const batchId = randomUUID();
  const userId =
    access.type === "admin"
      ? access.session.adminId
      : access.session.userId;

  const rows = await db
    .select({
      name: projects.name,
      description: projects.description,
      clientName: projects.clientName,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) {
    return Response.json({ error: "Projekt nie istnieje" }, { status: 404 });
  }

  const systemPrompt = `Jesteś AI asystentem Strategy Hub dla projektu: **${project.name}**.
${project.clientName ? `Klient: ${project.clientName}.` : ""}
${project.description ? `Opis: ${project.description}.` : ""}

Masz pełne uprawnienia edycji strategii (create_entity, update_entity, delete_entity, relacje).
Zmiany wykonuj od razu gdy intencja jest jasna; przy >5 encjach najpierw plan.
Każda zmiana jest odwracalna (undo). Po zmianach podsumuj co i dlaczego.
Nawigując po strategii używaj get_neighbors i find_path; gdy omawiasz konkretny element, wywołaj focus_map_node, żeby pokazać go na mapie. Gdy użytkownik pyta o wpływ/pochodzenie elementu end-to-end, użyj focus_map_node z mode:'thread'.
${tools.webSearch ? "Masz web_search." : ""}${tools.notionRead ? " Masz read_notion." : ""}

Odpowiadaj po polsku. Markdown. batchId: ${batchId}${aiRules?.trim() ? `\n\n## Zasady użytkownika\n${aiRules.trim()}` : ""}`;

  const result = streamText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    tools: {
      ...buildChatTools(projectId, tools),
      ...buildGraphTools(projectId),
      ...buildWriteTools(projectId, { batchId, source: "ai", userId }),
    },
    maxSteps: 15,
    temperature: 0.7,
  });

  return result.toDataStreamResponse({
    headers: { "X-Hub-Batch-Id": batchId },
  });
}