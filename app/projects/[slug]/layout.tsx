import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { SyntanceLogo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { ClientNav } from "@/components/dashboard/client-nav";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { notFound } from "next/navigation";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4">
            <SyntanceLogo />
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
          <ClientNav slug={slug} projectName={project.name} />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
