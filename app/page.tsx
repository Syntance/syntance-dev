import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/client-portal/queries";
import { SyntanceLogo } from "@/components/logo";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();

  if (session?.type === "admin") {
    redirect("/strategy-hub");
  }

  if (session?.type === "client") {
    const { isAdmin, projects } = await getProjectsForUser(session.email);
    if (isAdmin) {
      redirect("/strategy-hub");
    }
    if (projects.length === 1) {
      redirect(`/projects/${projects[0].slug}`);
    }
    redirect("/projects");
  }

  return (
    <div className="min-h-screen">
      <div className="absolute left-6 top-6">
        <SyntanceLogo />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
        <div className="max-w-md text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight">
            Client Portal
          </h1>
          <p className="text-muted-foreground">
            Śledź postęp swojego projektu i przeglądaj live preview
            — wszystko w jednym miejscu.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-light"
        >
          Zaloguj się
        </Link>
      </div>
    </div>
  );
}
