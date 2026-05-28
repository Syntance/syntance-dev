"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Server,
  Link2,
  FileText,
  BarChart3,
  Globe,
  TrendingUp,
  Users,
  Gauge,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = (slug: string) => [
  {
    href: `/projects/${slug}`,
    icon: LayoutDashboard,
    label: "Przegląd",
    exact: true,
  },
  {
    href: `/projects/${slug}/preview`,
    icon: Monitor,
    label: "Podgląd strony",
  },
  {
    href: `/projects/${slug}/strategy/map`,
    icon: MapIcon,
    label: "Mapa strategii",
    badge: "Nowe",
  },
  {
    href: `/projects/${slug}/hosting`,
    icon: Server,
    label: "Serwisy i hosting",
  },
  {
    href: `/projects/${slug}/links`,
    icon: Link2,
    label: "Linki i zasoby",
  },
  {
    href: `/projects/${slug}/strategy/business`,
    icon: FileText,
    label: "Strategia biznesowa",
    badge: "Nowe",
    moduleKey: "business",
  },
  {
    href: `/projects/${slug}/strategy/segments`,
    icon: Users,
    label: "Segmenty",
    badge: "Nowe",
    moduleKey: "segments",
  },
  {
    href: `/projects/${slug}/strategy/marketing`,
    icon: BarChart3,
    label: "Strategia marketingowa",
    badge: "Nowe",
    moduleKey: "marketing",
  },
  {
    href: `/projects/${slug}/strategy/kpi`,
    icon: Gauge,
    label: "KPI",
    badge: "Nowe",
    moduleKey: "kpi",
  },
  {
    href: `/projects/${slug}/strategy/website`,
    icon: Globe,
    label: "Strona",
    moduleKey: "website",
  },
  {
    href: `/projects/${slug}/reports`,
    icon: TrendingUp,
    label: "Raporty",
    soon: true,
  },
];

interface ClientNavProps {
  slug: string;
  projectName: string;
  hiddenModules?: string[];
  inProgressModules?: string[];
}

export function ClientNav({
  slug,
  hiddenModules = [],
  inProgressModules = [],
}: ClientNavProps) {
  const pathname = usePathname();
  const hidden = new Set(hiddenModules);
  const inProgress = new Set(inProgressModules);

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const items = navItems(slug).filter(
    (item) => !("moduleKey" in item && item.moduleKey && hidden.has(item.moduleKey))
  );

  return (
    <nav className="flex flex-col gap-0.5 w-full">
      {items.map((item) => {
        const wip =
          "moduleKey" in item && item.moduleKey && inProgress.has(item.moduleKey);
        return (
          <Link
            key={item.href}
            href={item.soon ? "#" : item.href}
            aria-disabled={item.soon}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              isActive(item.href, item.exact)
                ? "bg-brand/15 text-brand font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              item.soon && "opacity-50 cursor-default pointer-events-none"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {wip ? (
              <span className="ml-auto text-[9px] font-semibold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full">
                w budowie
              </span>
            ) : (
              item.badge && (
                <span className="ml-auto text-[9px] font-semibold bg-brand/20 text-brand px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )
            )}
            {item.soon && (
              <span className="ml-auto text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                wkrótce
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
