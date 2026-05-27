import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { NavSidebar } from "@/components/strategy-hub/nav-sidebar";
import { Separator } from "@/components/ui/separator";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";

export default async function StrategyHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStrategyHubAccess();

  return (
    <SidebarProvider>
      <NavSidebar />
      <div className="flex flex-1 flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            Strategy Hub
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
