import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { SyntanceLogo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { ClientNav } from "@/components/dashboard/client-nav";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects as dbProjects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getProjectVisibility } from "@/lib/strategy-hub/visibility";
import { getWorkspaceBrandingForProject } from "@/lib/client-portal/branding";
import Image from "next/image";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

function colorValue(
  colors: { role: string; value: string }[],
  role: string
): string | undefined {
  return colors.find((c) => c.role === role)?.value;
}

export default async function ProjectDashboardLayout({ children, params }: Props) {
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

  // Widoczność modułów (z relacyjnej bazy Drizzle, po slug)
  let hiddenModules: string[] = [];
  let inProgressModules: string[] = [];
  let branding: Awaited<ReturnType<typeof getWorkspaceBrandingForProject>> = null;
  try {
    const [dbProject] = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (dbProject) {
      const vis = await getProjectVisibility(dbProject.id);
      hiddenModules = Object.entries(vis.modules)
        .filter(([, s]) => s === "hidden")
        .map(([k]) => k);
      inProgressModules = Object.entries(vis.modules)
        .filter(([, s]) => s === "in_progress")
        .map(([k]) => k);
      branding = await getWorkspaceBrandingForProject(dbProject.id).catch(() => null);
    }
  } catch {
    // brak danych = wszystko widoczne
  }

  const brandStyle = branding?.colors.length
    ? ({
        ...(colorValue(branding.colors, "brand") && {
          "--brand": colorValue(branding.colors, "brand"),
        }),
        ...(colorValue(branding.colors, "brand-light") && {
          "--brand-light": colorValue(branding.colors, "brand-light"),
        }),
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen flex flex-col" style={brandStyle}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4">
            {branding?.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt="Logo"
                width={140}
                height={40}
                unoptimized
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <SyntanceLogo />
            )}
            <span className="text-sm text-muted-foreground hidden sm:block">
              /
            </span>
            <span className="text-sm font-medium truncate hidden sm:block max-w-[200px]">
              {project.name}
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col gap-2 border-r border-border px-3 py-6 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <p className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
            {project.name}
          </p>
          <ClientNav
            slug={slug}
            projectName={project.name}
            hiddenModules={hiddenModules}
            inProgressModules={inProgressModules}
          />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
