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
  },
  {
    href: `/projects/${slug}/strategy/segments`,
    icon: Users,
    label: "Segmenty",
    badge: "Nowe",
  },
  {
    href: `/projects/${slug}/strategy/marketing`,
    icon: BarChart3,
    label: "Strategia marketingowa",
    badge: "Nowe",
  },
  {
    href: `/projects/${slug}/strategy/kpi`,
    icon: Gauge,
    label: "KPI",
    badge: "Nowe",
  },
  {
    href: `/projects/${slug}/strategy/website`,
    icon: Globe,
    label: "Strona",
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
}

export function ClientNav({ slug, projectName }: ClientNavProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-col gap-0.5 w-full">
      {navItems(slug).map((item) => (
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
          {item.badge && (
            <span className="ml-auto text-[9px] font-semibold bg-brand/20 text-brand px-1.5 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
          {item.soon && (
            <span className="ml-auto text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
              wkrótce
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
