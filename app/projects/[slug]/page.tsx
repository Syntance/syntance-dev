import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import {
  Monitor,
  Server,
  FileText,
  BarChart3,
  Globe,
  ArrowRight,
  Users,
  Gauge,
} from "lucide-react";
import { ClientOnboardingTracker } from "@/components/dashboard/client-onboarding-tracker";

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

      {/* Status realizacji — tracker dostawy (7 kroków, Faza 16) */}
      <ClientOnboardingTracker status={project.status} />

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
