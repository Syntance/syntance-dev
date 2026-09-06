import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertTriangle } from "lucide-react";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { assertProjectAccess } from "@/lib/strategy-hub/context";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";
import { forkFoundation } from "@/lib/strategy-hub/fork-foundation";
import { ArchiveProjectDialog } from "@/components/strategy-hub/archive-project-dialog";
import { ProjectPlacementForm } from "./project-placement-form";

export const metadata = { title: "Ogólne" };

interface Props {
  params: Promise<{ id: string }>;
}

const kindSchema = z.enum(["firma", "galaz", "produkt"]);

/** Czy `kandydat` jest potomkiem `projectId` — taki rodzic zrobiłby cykl. */
async function jestPotomkiem(
  kandydatId: string,
  projectId: string
): Promise<boolean> {
  let biezacy: string | null = kandydatId;
  for (let i = 0; i < 10 && biezacy; i += 1) {
    if (biezacy === projectId) return true;
    const [row] = await db
      .select({ parentProjectId: projects.parentProjectId })
      .from(projects)
      .where(eq(projects.id, biezacy))
      .limit(1);
    biezacy = row?.parentProjectId ?? null;
  }
  return false;
}

async function zapiszUmiejscowienie(formData: FormData) {
  "use server";

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string") return;

  const auth = await assertProjectAccess(projectId);
  if (!auth.ok) return;

  const kind = kindSchema.catch("firma").parse(formData.get("kind"));

  const zgloszony = formData.get("parentProjectId");
  let parentProjectId: string | null = null;
  if (typeof zgloszony === "string" && zgloszony !== "") {
    const [kandydat] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, zgloszony),
          eq(projects.organizationId, auth.project.organizationId),
          ne(projects.id, projectId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (kandydat && !(await jestPotomkiem(kandydat.id, projectId))) {
      parentProjectId = kandydat.id;
    }
  }

  // Bez rodzica dziedziczenie nie ma dokąd prowadzić — degradujemy tryb,
  // żeby nie zostawić projektu z zerwanym łańcuchem.
  const patch: {
    kind: string;
    parentProjectId: string | null;
    updatedAt: Date;
    strategyMode?: string;
  } = { kind, parentProjectId, updatedAt: new Date() };

  if (!parentProjectId) patch.strategyMode = "wlasna";

  await db.update(projects).set(patch).where(eq(projects.id, projectId));

  revalidatePath(`/strategy-hub/projects/${projectId}/project-settings/general`);
  revalidatePath("/strategy-hub");
}

async function ustawDziedziczenie(formData: FormData) {
  "use server";

  const projectId = formData.get("projectId");
  const tryb = formData.get("tryb");
  if (typeof projectId !== "string") return;

  const auth = await assertProjectAccess(projectId);
  if (!auth.ok) return;

  if (tryb === "dziedziczona") {
    if (!auth.project.parentProjectId) return;
    await db
      .update(projects)
      .set({ strategyMode: "dziedziczona", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  } else {
    // Odłączenie kopiuje fundament — inaczej projekt zostałby z pustką.
    await forkFoundation(projectId);
  }

  revalidatePath(`/strategy-hub/projects/${projectId}`);
  revalidatePath("/strategy-hub");
}

export default async function ProjectGeneralSettingsPage({ params }: Props) {
  const { id } = await params;

  const auth = await assertProjectAccess(id);
  if (!auth.ok) notFound();
  const project = auth.project;

  const kandydaci = await db
    .select({ id: projects.id, name: projects.name, kind: projects.kind })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, project.organizationId),
        ne(projects.id, project.id),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(asc(projects.name));

  // Odfiltruj potomków — nie mogą być rodzicem (cykl).
  const dozwoleniRodzice = [];
  for (const k of kandydaci) {
    if (!(await jestPotomkiem(k.id, project.id))) dozwoleniRodzice.push(k);
  }

  const zrodlo = await resolveFoundationSource(project.id);
  const nazwaZrodla =
    zrodlo.inherited && zrodlo.projectId !== project.id
      ? kandydaci.find((k) => k.id === zrodlo.projectId)?.name ??
        zrodlo.sourceName
      : null;

  return (
    <div className="space-y-6">
      <ProjectPlacementForm
        projectId={project.id}
        organizationName={auth.organization?.name ?? "organizacja"}
        kind={project.kind}
        parentProjectId={project.parentProjectId}
        strategyMode={project.strategyMode}
        parentOptions={dozwoleniRodzice}
        foundationSourceName={nazwaZrodla}
        brokenChain={zrodlo.brokenChain ?? null}
        onSavePlacement={zapiszUmiejscowienie}
        onSetInheritance={ustawDziedziczenie}
      />

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h2 className="text-sm font-medium">Strefa niebezpieczna</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Archiwizacja ukrywa projekt „{project.name}” z listy projektów i ze
          wszystkich widoków Strategy Hub. To operacja odwracalna — dane
          projektu pozostają w bazie.
        </p>
        <ArchiveProjectDialog projectId={project.id} projectName={project.name} />
      </div>
    </div>
  );
}
