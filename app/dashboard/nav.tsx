"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Monitor, BarChart3, MessageSquare } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Podgląd", icon: Monitor },
  { href: "/dashboard/status", label: "Status", icon: BarChart3 },
  { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === "/dashboard" || pathname === "/dashboard/preview"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent/10 text-accent-light"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
