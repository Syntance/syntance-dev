"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutGrid,
  Settings,
  RefreshCw,
  Sparkles,
  Gem,
  Users,
  Megaphone,
  Gauge,
  LayoutDashboard,
  Map as MapIcon,
  LogOut,
  Clock,
  Puzzle,
  ChevronRight,
  SlidersHorizontal,
  NotebookPen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useProject, useProjectIdFromPath } from "@/components/strategy-hub/project-context";
import { PathSelector } from "@/components/strategy-hub/path-selector";
import { useProjectLiveUpdates } from "@/lib/strategy-hub/use-live-updates";
import {
  type AreaKey,
  type AreaState,
  AREA_SEGMENT,
  AREA_TABS,
  areaStateFromModules,
  areaTabHref,
  healthDotClass,
  projectAreaHref,
} from "@/lib/strategy-hub/area-routes";
import { cn } from "@/lib/utils";

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

const projectViewItems = (projectId: string) => [
  {
    label: "Mapa firmy",
    href: `/strategy-hub/projects/${projectId}`,
    icon: MapIcon,
    exact: true,
  },
  {
    label: "Strategy Canvas",
    href: `/strategy-hub/projects/${projectId}/canvas`,
    icon: LayoutDashboard,
  },
];

const areaItems = (projectId: string) =>
  [
    {
      key: "foundation" as const,
      label: "Fundament",
      href: projectAreaHref(projectId, "foundation"),
      icon: Gem,
    },
    {
      key: "market" as const,
      label: "Rynek",
      href: projectAreaHref(projectId, "market"),
      icon: Users,
    },
    {
      key: "execution" as const,
      label: "Egzekucja",
      href: projectAreaHref(projectId, "execution"),
      icon: Megaphone,
    },
    {
      key: "measurement" as const,
      label: "Pomiar",
      href: projectAreaHref(projectId, "measurement"),
      icon: Gauge,
    },
    {
      key: "info" as const,
      label: "Informacja i notatki",
      href: projectAreaHref(projectId, "info"),
      icon: NotebookPen,
    },
    {
      key: "settings" as const,
      label: "Ustawienia projektu",
      href: projectAreaHref(projectId, "settings"),
      icon: Settings,
    },
  ] satisfies {
    key: AreaKey;
    label: string;
    href: string;
    icon: typeof Gem;
  }[];

interface HealthModule {
  key: string;
  score: number;
  state: AreaState | "review";
}

export function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const projectFromContext = useProject();
  const projectIdFromPath = useProjectIdFromPath();
  const projectId = projectFromContext?.id ?? projectIdFromPath;
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [healthModules, setHealthModules] = useState<HealthModule[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Set<AreaKey>>(() => {
    if (!projectId) return new Set();
    const active = areaItems(projectId).find((item) =>
      pathname.startsWith(item.href)
    );
    return active ? new Set([active.key]) : new Set();
  });


  const toggleAreaExpanded = useCallback((key: AreaKey) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Rozwinięcie obszaru i reset health wynikają z lokalizacji/projektu — liczymy je
  // podczas renderu (wzorzec „poprzedni prop"), bez set-state-in-effect.
  const [prevNav, setPrevNav] = useState({ pathname, projectId });
  if (pathname !== prevNav.pathname || projectId !== prevNav.projectId) {
    setPrevNav({ pathname, projectId });
    if (!projectId) {
      setExpandedAreas(new Set());
    } else {
      const active = areaItems(projectId).find((item) =>
        pathname.startsWith(item.href)
      );
      setExpandedAreas(active ? new Set([active.key]) : new Set());
    }
    if (projectId !== prevNav.projectId) setHealthModules([]);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user); })
      .catch(() => null);
  }, []);

  const fetchHealth = useCallback((signal?: AbortSignal) => {
    if (!projectId) return;
    fetch(`/api/strategy-hub/projects/${projectId}/health`, { signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { modules?: HealthModule[] } | null) => {
        setHealthModules(data?.modules ?? []);
      })
      .catch(() => setHealthModules([]));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal);
    return () => ctrl.abort();
  }, [projectId, fetchHealth]);

  // Realtime (<5s, spec): zmiana w projekcie (dowolne źródło — Hub/Notion/MCP)
  // odświeża health-score kropek bez czekania na kolejne wejście użytkownika.
  useProjectLiveUpdates(projectId, useCallback(() => fetchHealth(), [fetchHealth]));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  function areaDotState(areaKey: AreaKey): AreaState {
    return areaStateFromModules(areaKey, healthModules);
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="box-border flex h-12 shrink-0 flex-row items-center gap-0 border-b border-border px-4 py-0">
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
                Projekt
              </SidebarGroupLabel>
              <SidebarMenu>
                {projectViewItems(projectId).map((item) => (
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
                Obszary
              </SidebarGroupLabel>
              <SidebarMenu>
                {areaItems(projectId).map((item) => {
                  const areaState = areaDotState(item.key);
                  const segment = AREA_SEGMENT[item.key];
                  const tabs = AREA_TABS[item.key];
                  const areaActive = isActive(item.href);
                  const expanded = expandedAreas.has(item.key);
                  const firstTabHref = areaTabHref(projectId, segment, tabs[0]?.slug ?? "");

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={firstTabHref} />}
                        isActive={areaActive}
                        tooltip={item.label}
                      >
                        <item.icon className="size-4" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span
                          aria-hidden
                          className={`size-2 shrink-0 rounded-full ${healthDotClass(areaState)} group-data-[collapsible=icon]:hidden`}
                        />
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        type="button"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? `Zwiń podgałęzie: ${item.label}`
                            : `Rozwiń podgałęzie: ${item.label}`
                        }
                        onClick={() => toggleAreaExpanded(item.key)}
                        className="group-data-[collapsible=icon]:hidden"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 transition-transform duration-200",
                            expanded && "rotate-90"
                          )}
                        />
                      </SidebarMenuAction>
                      {expanded ? (
                        <SidebarMenuSub>
                          {tabs.map((tab) => {
                            const tabHref = areaTabHref(projectId, segment, tab.slug);
                            const tabActive =
                              pathname === tabHref ||
                              pathname.startsWith(`${tabHref}/`);
                            return (
                              <SidebarMenuSubItem key={tab.slug}>
                                <SidebarMenuSubButton
                                  render={<Link href={tabHref} />}
                                  isActive={tabActive}
                                  size="sm"
                                >
                                  <span>{tab.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
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
                render={<Link href="/strategy-hub/settings/rules" />}
                isActive={isActive("/strategy-hub/settings/rules")}
                tooltip="Reguły strategii"
              >
                <SlidersHorizontal className="size-4" />
                <span>Reguły strategii</span>
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
