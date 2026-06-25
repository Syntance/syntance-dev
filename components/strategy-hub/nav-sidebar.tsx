"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  FileText,
  BarChart3,
  Globe,
  Settings,
  RefreshCw,
  Sparkles,
  Server,
  MessageSquareText,
  Compass,
  Gem,
  Users,
  Filter,
  Megaphone,
  Gauge,
  LayoutDashboard,
  Map as MapIcon,
  LogOut,
  Clock,
  Puzzle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useProject, useProjectIdFromPath } from "@/components/strategy-hub/project-context";
import { PathSelector } from "@/components/strategy-hub/path-selector";

const navItems = [
  {
    label: "Projekty",
    href: "/strategy-hub",
    icon: LayoutGrid,
    exact: true,
  },
];

const customAppItems = [
  {
    label: "Liczenie godzin",
    description: "Timer · wpisy · rozliczenia",
    href: "/strategy-hub/apps/time-tracking",
    icon: Clock,
  },
];

const viewItems = (projectId: string) => [
  {
    label: "Widok główny",
    href: `/strategy-hub/projects/${projectId}`,
    icon: LayoutGrid,
    exact: true,
  },
  {
    label: "Strategy Canvas",
    href: `/strategy-hub/projects/${projectId}/canvas`,
    icon: LayoutDashboard,
  },
  {
    label: "Strategy Map",
    href: `/strategy-hub/projects/${projectId}/strategy-map`,
    icon: MapIcon,
  },
];

const strategyItems = (projectId: string) => [
  {
    label: "Discovery",
    href: `/strategy-hub/projects/${projectId}/discovery`,
    icon: Compass,
  },
  {
    label: "Marka",
    href: `/strategy-hub/projects/${projectId}/brand`,
    icon: Gem,
  },
  {
    label: "Strategia biznesowa",
    href: `/strategy-hub/projects/${projectId}/business`,
    icon: FileText,
  },
  {
    label: "Segmenty",
    href: `/strategy-hub/projects/${projectId}/segments`,
    icon: Users,
  },
  {
    label: "Lejek i kanały",
    href: `/strategy-hub/projects/${projectId}/funnel`,
    icon: Filter,
  },
  {
    label: "Sprzedaż i copy",
    href: `/strategy-hub/projects/${projectId}/sales`,
    icon: Megaphone,
  },
  {
    label: "Strategia marketingowa",
    href: `/strategy-hub/projects/${projectId}/marketing`,
    icon: BarChart3,
  },
  {
    label: "Strona",
    href: `/strategy-hub/projects/${projectId}/website`,
    icon: Globe,
  },
  {
    label: "KPI",
    href: `/strategy-hub/projects/${projectId}/kpi`,
    icon: Gauge,
  },
  {
    label: "Infrastruktura",
    href: `/strategy-hub/projects/${projectId}/admin`,
    icon: Server,
  },
  {
    label: "AI Chat",
    href: `/strategy-hub/projects/${projectId}/chat`,
    icon: MessageSquareText,
  },
];

export function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const projectFromContext = useProject();
  const projectIdFromPath = useProjectIdFromPath();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user); })
      .catch(() => null);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const projectId = projectFromContext?.id ?? projectIdFromPath;

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link
          href="/strategy-hub"
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="size-7 rounded-lg bg-brand flex items-center justify-center shrink-0 shadow-[var(--brand-glow)]">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight truncate group-data-[collapsible=icon]:hidden">
            Strategy Hub
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Nawigacja
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive(item.href, item.exact)}
                  tooltip={item.label}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {projectId && (
          <>
            <SidebarSeparator />
            <PathSelector projectId={projectId} />
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                Widoki
              </SidebarGroupLabel>
              <SidebarMenu>
                {viewItems(projectId).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive(item.href, "exact" in item && item.exact)}
                      tooltip={item.label}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                Strategia
              </SidebarGroupLabel>
              <SidebarMenu>
                {strategyItems(projectId).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden flex items-center gap-1.5">
            <Puzzle className="size-3.5 text-brand/80" />
            Custom Apps
          </SidebarGroupLabel>
          <SidebarMenu>
            {customAppItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                  className="h-auto py-2.5 group-data-[collapsible=icon]:py-2"
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex flex-col items-start gap-0.5 min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium leading-none">
                      {item.label}
                    </span>
                    {"description" in item && item.description ? (
                      <span className="truncate text-[10px] font-normal text-muted-foreground leading-none">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            System
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/strategy-hub/sync" />}
                isActive={isActive("/strategy-hub/sync")}
                tooltip="Sync z Notion"
              >
                <RefreshCw className="size-4" />
                <span>Sync z Notion</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/strategy-hub/settings" />}
                tooltip="Ustawienia"
              >
                <Settings className="size-4" />
                <span>Ustawienia</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:justify-center">
          <div className="size-6 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-brand">
              {user ? user.name[0].toUpperCase() : "?"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden flex-1">
            {user ? `${user.name} · ${user.role}` : "…"}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Wyloguj się"
            className="shrink-0 group-data-[collapsible=icon]:hidden p-1 rounded-md text-muted-foreground/50 transition-colors hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
