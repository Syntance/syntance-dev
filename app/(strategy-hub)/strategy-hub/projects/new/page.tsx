import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { projects, businessStrategy } from "@/db/schema";
import { requireStrategyHubAccess, getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";

export const metadata = { title: "Nowy projekt" };

async function createProject(formData: FormData) {
  "use server";

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const clientName = formData.get("clientName") as string;
  const domain = formData.get("domain") as string;
  const description = formData.get("description") as string;
  const icon = (formData.get("icon") as string) || "🏢";

  if (!name || !slug) return;

  const access = await requireStrategyHubAccess();
  const ws = await getOrCreateWorkspaceForAdmin(access.session.email);

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: ws.id,
      name,
      slug: slug.toLowerCase().replace(/\s+/g, "-"),
      clientName: clientName || null,
      domain: domain || null,
      description: description || null,
      icon: icon || "🏢",
      status: "active",
    })
    .returning();

  // Inicjuj pusty dokument strategii biznesowej
  await db
    .insert(businessStrategy)
    .values({ projectId: project.id })
    .onConflictDoNothing();

  redirect(`/strategy-hub/projects/${project.id}`);
}

export default function NewProjectPage() {
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

      <form action={createProject} className="space-y-5">
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <div className="space-y-1.5">
            <Label htmlFor="icon" className="text-xs">Ikona</Label>
            <Input
              id="icon"
              name="icon"
              placeholder="🏢"
              defaultValue="🏢"
              className="w-16 text-center text-lg"
              maxLength={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Nazwa projektu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="RetroHouse"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-xs">
            Slug <span className="text-destructive">*</span>
          </Label>
          <Input
            id="slug"
            name="slug"
            placeholder="retrohouse"
            required
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Używany jako identyfikator w URL. Tylko małe litery i myślniki.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientName" className="text-xs">Nazwa klienta</Label>
            <Input id="clientName" name="clientName" placeholder="Jan Kowalski" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domain" className="text-xs">Domena</Label>
            <Input id="domain" name="domain" placeholder="retrohouse.pl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs">Opis projektu</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Krótki opis — co to za projekt, dla kogo, jaki cel."
            rows={3}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/strategy-hub">Anuluj</Link>
          </Button>
          <Button type="submit" size="sm" className="bg-brand hover:bg-brand/90 text-white">
            Utwórz projekt
          </Button>
        </div>
      </form>
    </div>
  );
}
