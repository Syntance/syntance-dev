import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SyntanceLogo } from "@/components/logo";
import Link from "next/link";

export default async function HomePage() {
  const headersList = await headers();
  const slug = headersList.get("x-project-slug");

  if (slug) {
    const session = await getSession();
    if (session && session.type === "client") {
      redirect("/dashboard");
    }
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <SyntanceLogo className="scale-150" />
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight">
          Client Portal
        </h1>
        <p className="text-muted-foreground">
          Śledź postęp swojego projektu, przeglądaj live preview i zostaw
          feedback — wszystko w jednym miejscu.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-light"
        >
          Zaloguj się
        </Link>
        <Link
          href="/admin"
          className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          Panel admina
        </Link>
      </div>
    </div>
  );
}
