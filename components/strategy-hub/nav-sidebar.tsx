"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  BarChart3,
  Globe,
  Settings,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    label: "Projekty",
    href: "/strategy-hub",
    icon: LayoutGrid,
    exact: true,
  },
];

const strategyItems = (projectId: string) => [
  {
    label: "Strategia biznesowa",
    href: `/strategy-hub/projects/${projectId}/business`,
    icon: FileText,
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
    label: "Infrastruktura",
    href: `/strategy-hub/projects/${projectId}/admin`,
    icon: Server,
  },
];

interface NavSidebarProps {
  projectId?: string;
  projectName?: string;
}

export function NavSidebar({ projectId, projectName }: NavSidebarProps) {
  const pathname = usePathname();

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
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden flex items-center gap-1.5">
                <span className="truncate">{projectName ?? "Projekt"}</span>
                <ChevronRight className="size-3 shrink-0 opacity-50" />
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
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            System
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/strategy-hub/sync" />}
                tooltip="Sync z Notion"
              >
                <RefreshCw className="size-4" />
                <span>Sync z Notion</span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-[10px] px-1.5 h-4 group-data-[collapsible=icon]:hidden"
                >
                  wkrótce
                </Badge>
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
            <span className="text-[10px] font-semibold text-brand">K</span>
          </div>
          <span className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
            Kamil · owner
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
