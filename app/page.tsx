import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SyntanceLogo } from "@/components/logo";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();

  if (session && session.type === "client") {
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
