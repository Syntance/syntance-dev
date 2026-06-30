import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { getProjectVisibility, moduleStatus } from "@/lib/strategy-hub/visibility";
import { HealthRing } from "@/components/strategy-hub/health-ring";
import { ModuleVisibility } from "@/components/strategy-hub/module-visibility";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Strategy Canvas · ${rows[0]?.name ?? "Projekt"}` };
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 40) return "bg-brand";
  return "bg-muted-foreground/40";
}

export default async function CanvasPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const rows = await db
    .select({ id: projects.id, name: projects.name, icon: projects.icon })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) notFound();

  const [health, visibility] = await Promise.all([
    computeProjectHealth(id),
    getProjectVisibility(id),
  ]);

  const sorted = [...health.modules].sort((a, b) => a.score - b.score);
  const weakest = sorted.filter((m) => m.score < 100).slice(0, 3);

  const moduleVis = health.modules.map((m) => ({
    key: m.key,
    label: m.label,
    status: moduleStatus(visibility, m.key),
  }));

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="size-5 text-brand" />
        <h1 className="text-xl font-semibold tracking-tight">Strategy Canvas</h1>
      </div>

      {/* Health overview */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-6">
        <HealthRing score={health.score} />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <h2 className="text-sm font-medium">Kondycja strategii</h2>
          <p className="text-sm text-muted-foreground">
            {health.score >= 80
              ? "Strategia jest niemal kompletna — gotowa do prezentacji klientowi."
              : health.score >= 40
                ? "Solidny fundament. Uzupełnij słabsze moduły, by domknąć obraz."
                : "Strategia dopiero powstaje. Zacznij od modułów z najniższym wynikiem."}
          </p>
          {weakest.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
              {weakest.map((m) => (
                <Link
                  key={m.key}
                  href={m.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-brand/40 transition-colors"
                >
                  {m.label}
                  <span className="tabular-nums opacity-60">{m.score}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module breakdown */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground mb-1">
          Moduły
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {health.modules.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className="group rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {m.score}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreColor(m.score)}`}
                  style={{ width: `${m.score}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs text-muted-foreground">{m.hint}</span>
                <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-brand transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <ModuleVisibility projectId={id} modules={moduleVis} />
    </div>
  );
}
