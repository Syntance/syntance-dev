import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  BarChart3,
  Globe,
  Users,
  Target,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Compass,
  Gem,
  Filter,
} from "lucide-react";
import { db } from "@/db";
import { projects, businessStrategy, segments, kpis } from "@/db/schema";
import { parseStrategyListItems } from "@/lib/strategy-hub/business-strategy-lists";
import { eq, isNull, and, count } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProjectData(id: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) return null;

  const [strategy] = await db
    .select()
    .from(businessStrategy)
    .where(eq(businessStrategy.projectId, id))
    .limit(1);

  const [segmentCount] = await db
    .select({ count: count() })
    .from(segments)
    .where(and(eq(segments.projectId, id), isNull(segments.deletedAt)));

  const [kpiCount] = await db
    .select({ count: count() })
    .from(kpis)
    .where(and(eq(kpis.projectId, id), isNull(kpis.deletedAt)));

  return { project, strategy, segmentCount, kpiCount };
}

const modules = (id: string) => [
  {
    href: `/strategy-hub/projects/${id}/discovery`,
    icon: Compass,
    label: "Discovery",
    description: "Pytania, słownik, dostępy, materiały",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/brand`,
    icon: Gem,
    label: "Marka",
    description: "Tożsamość, kolory, typografia, loga",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/business`,
    icon: FileText,
    label: "Strategia biznesowa",
    description: "Cele, UVP, konkurencja, obiekcje",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/segments`,
    icon: Users,
    label: "Segmenty",
    description: "Persona, JTBD, ścieżka, quick wins",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/funnel`,
    icon: Filter,
    label: "Lejek i kanały",
    description: "Funnel flow, plan kanałów, macierz",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/marketing`,
    icon: BarChart3,
    label: "Strategia marketingowa",
    description: "Segmenty, lejki, user flows, KPI",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    href: `/strategy-hub/projects/${id}/website`,
    icon: Globe,
    label: "Strona",
    description: "Podstrony, SEO, stack technologiczny",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getProjectData(id);
  } catch {
    data = null;
  }

  if (!data) notFound();

  const { project, strategy, segmentCount, kpiCount } = data;

  const strategyFilled =
    parseStrategyListItems(strategy?.goalsMd).length > 0 ||
    parseStrategyListItems(strategy?.uvpMd).length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Nagłówek projektu */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
            {project.icon ?? "🏢"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {project.name}
              </h1>
              <Badge variant="secondary" className="text-[10px] h-4">
                {project.status}
              </Badge>
            </div>
            {project.clientName && (
              <p className="text-sm text-muted-foreground">{project.clientName}</p>
            )}
            {project.domain && (
              <a
                href={`https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand hover:underline mt-0.5"
              >
                {project.domain}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/strategy-hub/projects/${id}/settings`}>
            Ustawienia
          </Link>
        </Button>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={FileText}
          label="Strategia biznesowa"
          value={strategyFilled ? "Uzupełniona" : "Pusta"}
          sub={strategyFilled ? "Gotowa do prezentacji" : "Uzupełnij sekcje"}
          filled={strategyFilled}
        />
        <StatCard
          icon={Users}
          label="Segmenty"
          value={String(segmentCount?.count ?? 0)}
          sub="grup docelowych"
        />
        <StatCard
          icon={Target}
          label="KPI"
          value={String(kpiCount?.count ?? 0)}
          sub="wskaźników"
        />
      </div>

      {/* Moduły strategii */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Moduły strategii
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {modules(id).map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-brand/30 transition-all duration-200"
            >
              <div
                className={`size-9 rounded-lg border flex items-center justify-center ${mod.bg}`}
              >
                <mod.icon className={`size-4 ${mod.color}`} />
              </div>
              <div>
                <div className="font-medium text-sm">{mod.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {mod.description}
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-brand transition-all duration-200 mt-auto" />
            </Link>
          ))}
        </div>
      </div>

      {/* Dashboard klienta */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="size-4 text-brand" />
              <span className="font-medium text-sm">Dashboard klienta</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Klient widzi strategię w swoim dashboardzie na{" "}
              <span className="font-mono">syntance.dev</span>.
            </p>
          </div>
          {project.clientAccessToken && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://syntance.dev/projects/${project.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Otwórz
                <ExternalLink className="size-3 ml-1.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  filled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  filled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div>
        <div
          className={`font-semibold text-base ${filled === true ? "text-success" : filled === false ? "text-muted-foreground" : ""}`}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
