import Link from "next/link";
import { and, count, inArray, isNull } from "drizzle-orm";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  requireStrategyHubAccess,
  listOrganizationsForAdmin,
} from "@/lib/strategy-hub/context";

/**
 * Widok „wszystkie organizacje" — poziom agencji. Nie ma tabeli agencji:
 * agencja to po prostu zbiór organizacji, do których dany admin ma członkostwo.
 */
export default async function OrganizationsPage() {
  const access = await requireStrategyHubAccess();
  const rows = await listOrganizationsForAdmin(access.session.email);

  const ids = rows.map((r) => r.organization.id);
  const liczniki = new Map<string, number>();
  if (ids.length > 0) {
    const counts = await db
      .select({ organizationId: projects.organizationId, n: count() })
      .from(projects)
      .where(
        and(inArray(projects.organizationId, ids), isNull(projects.deletedAt))
      )
      .groupBy(projects.organizationId);
    for (const c of counts) liczniki.set(c.organizationId, Number(c.n));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizacje</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length === 0
            ? "Nie należysz jeszcze do żadnej organizacji."
            : `${rows.length} ${organizacjeSuffix(rows.length)} · przełączasz je selektorem w lewym górnym rogu`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10">
            <Building2 className="size-6 text-brand" />
          </div>
          <h2 className="mb-1 text-sm font-medium">Brak organizacji</h2>
          <p className="mx-auto max-w-xs text-xs text-muted-foreground">
            Utwórz pierwszą organizację selektorem w lewym górnym rogu — to
            klient, w którego ramach będą żyły projekty.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ organization, role }) => (
            <Link
              key={organization.id}
              href={`/strategy-hub/org/${organization.id}`}
              className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand/40 hover:bg-card/80"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium leading-tight">
                  {organization.name}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {liczniki.get(organization.id) ?? 0}{" "}
                  {projektySuffix(liczniki.get(organization.id) ?? 0)}
                </p>
              </div>
              {role === "owner" && (
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 gap-1 px-1.5 text-[10px] font-normal"
                >
                  <ShieldCheck className="size-2.5" />
                  Właściciel
                </Badge>
              )}
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function projektySuffix(n: number): string {
  if (n === 1) return "projekt";
  const ostatnia = n % 10;
  const przedostatnia = Math.floor(n / 10) % 10;
  if (przedostatnia !== 1 && ostatnia >= 2 && ostatnia <= 4) return "projekty";
  return "projektów";
}

function organizacjeSuffix(n: number): string {
  if (n === 1) return "organizacja";
  const ostatnia = n % 10;
  const przedostatnia = Math.floor(n / 10) % 10;
  if (przedostatnia !== 1 && ostatnia >= 2 && ostatnia <= 4) return "organizacje";
  return "organizacji";
}
