import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { buildChatTools } from "@/lib/strategy-hub/ai-tools";

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
  tools: z.object({
    webSearch: z.boolean().default(false),
    notionRead: z.boolean().default(false),
  }).default({ webSearch: false, notionRead: false }),
  aiRules: z.string().max(2000).optional().default(""),
});

export async function POST(req: Request) {
  try {
    const session = await requireStrategyHubAccess();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY nie jest ustawiony. Dodaj go do zmiennych środowiskowych." },
      { status: 500 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    body = bodySchema.parse(raw);
  } catch {
    return Response.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const { projectId, messages, model, tools, aiRules } = body;

  const rows = await db
    .select({ name: projects.name, description: projects.description, clientName: projects.clientName })
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

Twoje zadania:
- Pomagasz tworzyć i rozwijać strategię biznesową, marketingową i stronę internetową projektu.
- Możesz **czytać dane projektu** (narzędzie: read_project) i **edytować strategię** (update_business_strategy, upsert_segment, upsert_kpi).
- Gdy użytkownik pyta o dane projektu, użyj read_project zanim zaczniesz odpowiadać.
- Gdy użytkownik chce coś zmienić w strategii, ZAWSZE najpierw przeczytaj aktualne dane, potem zaproponuj zmiany i — jeśli użytkownik potwierdzi — wykonaj update.
${tools.webSearch ? "- Możesz przeszukiwać internet (web_search) po aktualne dane o rynku, konkurencji, trendach." : ""}
${tools.notionRead ? "- Możesz czytać strony z Notion workspace (read_notion)." : ""}

Zasady:
- Odpowiadaj po **polsku** (chyba że użytkownik pisze po angielsku).
- Bądź konkretny i zadaj pytania, jeśli brakuje Ci kontekstu.
- Przy propozycji zmian pokaż różnicę przed/po.
- Nie zmieniaj danych bez potwierdzenia od użytkownika — chyba że sam poprosi o natychmiastowe zapisanie.
- Formatuj odpowiedzi w markdown: używaj # dla nagłówków, **bold** dla ważnych pojęć, - dla list.${aiRules?.trim() ? `\n\n## Dodatkowe zasady od użytkownika\n${aiRules.trim()}` : ""}`;

  const chatTools = buildChatTools(projectId, tools);

  const result = streamText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    tools: chatTools,
    maxSteps: 15,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}
