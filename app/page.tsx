import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Image from "next/image";

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
    <div className="flex min-h-screen items-center justify-center">
      <Image
        src="/logo-full.png"
        alt="Syntance"
        width={400}
        height={100}
        className="w-80 md:w-96"
        priority
      />
    </div>
  );
}
