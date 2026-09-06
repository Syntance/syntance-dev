import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { projects, businessStrategy } from "@/db/schema";
import {
  requireStrategyHubAccess,
  getCurrentOrganizationForAdmin,
} from "@/lib/strategy-hub/context";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "Nowy projekt" };

const kindSchema = z.enum(["firma", "galaz", "produkt"]);

async function createProject(formData: FormData) {
  "use server";

  const name = formData.get("name") as string;
  const clientName = formData.get("clientName") as string;
  const domain = formData.get("domain") as string;
  const description = formData.get("description") as string;
  const icon = (formData.get("icon") as string) || "🏢";

  if (!name) return;
  // Fallback: pusty slug nigdy nie blokuje submitu po cichu — derywujemy z nazwy.
  const slug =
    (formData.get("slug") as string) ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  if (!slug) return;

  const access = await requireStrategyHubAccess();
  const organization = await getCurrentOrganizationForAdmin(access.session.email);

  const kind = kindSchema.catch("firma").parse(formData.get("kind"));

  // Rodzic musi leżeć w TEJ SAMEJ organizacji — inaczej drzewo przeciekłoby
  // między klientami. Nieprawidłowa wartość jest cicho ignorowana (projekt
  // powstaje na najwyższym poziomie), nie przerywa tworzenia.
  const zgloszonyRodzic = formData.get("parentProjectId");
  let parentProjectId: string | null = null;
  if (typeof zgloszonyRodzic === "string" && zgloszonyRodzic !== "") {
    const [rodzic] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, zgloszonyRodzic),
          eq(projects.organizationId, organization.id),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);
    parentProjectId = rodzic?.id ?? null;
  }

  // Dziedziczenie bez rodzica nie ma sensu — łańcuch nie miałby dokąd prowadzić.
  const strategyMode =
    parentProjectId && formData.get("dziedziczyFundament") === "1"
      ? "dziedziczona"
      : "wlasna";

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name,
      slug: slug.toLowerCase().replace(/\s+/g, "-"),
      clientName: clientName || null,
      domain: domain || null,
      description: description || null,
      icon: icon || "🏢",
      status: "active",
      kind,
      parentProjectId,
      strategyMode,
    })
    .returning();

  // Inicjuj pusty dokument strategii biznesowej
  await db
    .insert(businessStrategy)
    .values({ projectId: project.id })
    .onConflictDoNothing();

  redirect(`/strategy-hub/projects/${project.id}`);
}

export default async function NewProjectPage() {
  const access = await requireStrategyHubAccess();
  const organization = await getCurrentOrganizationForAdmin(access.session.email);

  const parentOptions = await db
    .select({ id: projects.id, name: projects.name, kind: projects.kind })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organization.id),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(asc(projects.name));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/strategy-hub">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nowy projekt</h1>
          <p className="text-sm text-muted-foreground">
            Uzupełnij podstawowe dane, strategię możesz dodać później.
          </p>
        </div>
      </div>

      <NewProjectForm
        action={createProject}
        organizationName={organization.name}
        parentOptions={parentOptions}
      />
    </div>
  );
}
