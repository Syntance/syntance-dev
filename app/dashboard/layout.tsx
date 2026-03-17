import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getUserProjectsInfo } from "@/lib/get-project";
import { SyntanceLogo } from "@/components/logo";
import { DashboardNav } from "./nav";
import { LogoutButton } from "./logout-button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientSession();
  if (!session) {
    redirect("/login");
  }

  const { isAdmin, currentProject, client } = await getUserProjectsInfo();

  if (!client) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="https://syntance.dev/projects" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <SyntanceLogo />
            </Link>
            <div className="h-6 w-px bg-border" />
            <Link 
              href="https://syntance.dev/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Projekty
            </Link>
            {currentProject && (
              <>
                <div className="h-6 w-px bg-border" />
                <div>
                  <p className="text-sm font-medium">{currentProject.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentProject.slug}.syntance.dev
                  </p>
                </div>
              </>
            )}
            {isAdmin && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-light">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {currentProject && <DashboardNav />}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>

      <footer className="border-t border-border py-4">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-xs text-muted-foreground/50">
            Powered by Syntance
          </p>
        </div>
      </footer>
    </div>
  );
}
