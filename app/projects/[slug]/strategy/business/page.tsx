import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import { projects as dbProjects, businessStrategy } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { FileText, Target, Sparkles, Users, MessageSquare, Hammer } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import { StrategyItemCallout } from "@/components/strategy-hub/strategy-item-callout";
import { parseStrategyListItems } from "@/lib/strategy-hub/business-strategy-lists";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

type StrategyRow = typeof businessStrategy.$inferSelect;

async function getStrategy(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  strategy: StrategyRow | null;
}> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);

    if (!rows[0]) return { moduleVis: "visible", strategy: null };

    const projectId = rows[0].id;
    trackVisit(projectId, "business");

    const [stratRows, vis] = await Promise.all([
      db
        .select()
        .from(businessStrategy)
        .where(eq(businessStrategy.projectId, projectId))
        .limit(1),
      getProjectVisibility(projectId),
    ]);

    return {
      moduleVis: moduleStatus(vis, "business"),
      strategy: stratRows[0] ?? null,
    };
  } catch {
    return { moduleVis: "visible", strategy: null };
  }
}

const SECTIONS = [
  { key: "goalsMd" as const, label: "Cele biznesowe", icon: Target, list: true },
  {
    key: "uvpMd" as const,
    label: "Unikalna propozycja wartości",
    icon: Sparkles,
    list: true,
  },
  { key: "competitorsMd" as const, label: "Analiza konkurencji", icon: Users, list: false },
  { key: "objectionsMd" as const, label: "Obiekcje klientów", icon: MessageSquare, list: true },
];

function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-5 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-4 mb-1.5">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-brand/30 pl-4 text-muted-foreground italic">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/^(?!<[h|l|b|s])(.+)$/gm, '<p class="mt-2">$1</p>');
}

export default async function ClientBusinessStrategyPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }

  if (!project) notFound();

  const { moduleVis, strategy } = await getStrategy(slug);
  if (moduleVis === "hidden") notFound();

  const hasContent = strategy && SECTIONS.some((s) => {
    const content = strategy[s.key];
    if (s.list) return parseStrategyListItems(content).length > 0;
    return (content?.length ?? 0) > 0;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">
            Strategia biznesowa
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Strategia Twojego projektu — cele, propozycja wartości, otoczenie
          konkurencyjne.
        </p>
      </div>

      {moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pracujemy nad nią — wróć wkrótce.
          </p>
        </div>
      ) : !hasContent ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Strategia biznesowa jest jeszcze opracowywana.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Wróć tutaj, gdy Syntance ją uzupełni.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const content = strategy?.[section.key];
            const listItems = section.list
              ? parseStrategyListItems(content)
              : [];
            const hasSection = section.list
              ? listItems.length > 0
              : Boolean(content);

            if (!hasSection) return null;

            return (
              <div
                key={section.key}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <section.icon className="size-4 text-brand" />
                  <h2 className="font-medium text-sm">{section.label}</h2>
                </div>
                {section.list ? (
                  <ul className="space-y-0.5">
                    {listItems.map((item, index) => (
                      <StrategyItemCallout key={item.id} item={item} index={index} />
                    ))}
                  </ul>
                ) : (
                  <div
                    className="text-sm text-foreground/90 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(content ?? ""),
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
