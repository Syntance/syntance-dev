import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import {
  Monitor,
  Server,
  FileText,
  BarChart3,
  Globe,
  ArrowRight,
  CheckCircle2,
  Circle,
  Users,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_STEPS = [
  { key: "design", label: "Projektowanie" },
  { key: "development", label: "Development" },
  { key: "qa", label: "Testowanie" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
];

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectOverviewPage({ params }: Props) {
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

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === project.status);

  const quickLinks = [
    {
      href: `/projects/${slug}/preview`,
      icon: Monitor,
      label: "Podgląd strony",
      description: "Live preview Twojej strony",
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      href: `/projects/${slug}/hosting`,
      icon: Server,
      label: "Serwisy i hosting",
      description: "Panel hostingu, domeny, certyfikaty",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      href: `/projects/${slug}/strategy/business`,
      icon: FileText,
      label: "Strategia biznesowa",
      description: "Cele, UVP, konkurencja",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      badge: "Nowe",
    },
    {
      href: `/projects/${slug}/strategy/segments`,
      icon: Users,
      label: "Segmenty",
      description: "Persony, potrzeby, propozycja wartości",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      badge: "Nowe",
    },
    {
      href: `/projects/${slug}/strategy/marketing`,
      icon: BarChart3,
      label: "Strategia marketingowa",
      description: "Segmenty, lejki, KPI",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      badge: "Nowe",
    },
    {
      href: `/projects/${slug}/strategy/kpi`,
      icon: Gauge,
      label: "KPI",
      description: "Cele liczbowe i postęp",
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
      badge: "Nowe",
    },
    {
      href: `/projects/${slug}/strategy/website`,
      icon: Globe,
      label: "Strona",
      description: "Podstrony, SEO, stack",
      color: "text-sky-400",
      bg: "bg-sky-500/10 border-sky-500/20",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-prose">
            {project.description}
          </p>
        )}
      </div>

      {/* Status projektu */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">Status realizacji</h2>
          <Badge
            variant={project.status === "live" ? "default" : "secondary"}
            className={
              project.status === "live"
                ? "bg-success/20 text-success border-success/30"
                : ""
            }
          >
            {STATUS_STEPS[currentStepIdx]?.label ?? project.status}
          </Badge>
        </div>

        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-border" />
          <div
            className="absolute top-3.5 left-3.5 h-0.5 bg-brand transition-all duration-500"
            style={{
              width: `${(currentStepIdx / (STATUS_STEPS.length - 1)) * 100}%`,
            }}
          />

          <div className="relative flex justify-between">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              return (
                <div key={step.key} className="flex flex-col items-center gap-2">
                  <div
                    className={`size-7 rounded-full border-2 flex items-center justify-center z-10 bg-background transition-colors ${
                      done
                        ? "border-brand bg-brand"
                        : active
                          ? "border-brand bg-brand/10"
                          : "border-border"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5 text-white" />
                    ) : (
                      <Circle
                        className={`size-3 ${active ? "text-brand" : "text-muted-foreground/30"}`}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium hidden sm:block ${
                      active
                        ? "text-brand"
                        : done
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Szybki dostęp */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Sekcje projektu
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-all duration-200"
            >
              <div
                className={`size-9 rounded-lg border flex items-center justify-center shrink-0 ${link.bg}`}
              >
                <link.icon className={`size-4 ${link.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{link.label}</span>
                  {link.badge && (
                    <span className="text-[9px] font-semibold bg-brand/20 text-brand px-1.5 py-0.5 rounded-full">
                      {link.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {link.description}
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-brand transition-all shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
