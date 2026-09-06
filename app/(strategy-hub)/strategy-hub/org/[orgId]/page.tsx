import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  Building2,
  GitBranch,
  Package,
  Globe,
  Link2,
  ScrollText,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import { organizations, sites, domains, strategicDecisions } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  requireStrategyHubAccess,
  getOrganizationRole,
} from "@/lib/strategy-hub/context";
import {
  getProjectTree,
  resolveFoundationSource,
  type ProjectTreeNode,
} from "@/lib/strategy-hub/scope";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";

/**
 * Powyżej tego progu nie liczymy health-score per projekt przy renderze —
 * `computeProjectHealth` robi kilkanaście zapytań na projekt, więc dla dużej
 * organizacji zamieniłoby to podsumowanie w najwolniejszy ekran w aplikacji.
 * Zamiast udawać, że danych nie ma, mówimy wprost, dlaczego ich nie liczymy.
 */
const LIMIT_HEALTH = 12;

const KIND_LABELS: Record<string, string> = {
  firma: "Firma",
  galaz: "Gałąź",
  produkt: "Produkt",
};

const KIND_ICONS: Record<string, typeof Building2> = {
  firma: Building2,
  galaz: GitBranch,
  produkt: Package,
};

function splaszcz(wezly: ProjectTreeNode[]): ProjectTreeNode[] {
  return wezly.flatMap((w) => [w, ...splaszcz(w.children)]);
}

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const access = await requireStrategyHubAccess();

  const role = await getOrganizationRole(access.session.email, orgId);
  if (!role) notFound();

  const [organization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!organization) notFound();

  const drzewo = await getProjectTree(orgId);
  const plaskie = splaszcz(drzewo);
  const projectIds = plaskie.map((p) => p.id);

  const [strony, domeny, decyzje, zdrowie, zrodlaFundamentu] = await Promise.all([
    projectIds.length
      ? db
          .select({
            id: sites.id,
            projectId: sites.projectId,
            name: sites.name,
            domain: sites.domain,
            isPrimary: sites.isPrimary,
          })
          .from(sites)
          .where(
            and(inArray(sites.projectId, projectIds), isNull(sites.deletedAt))
          )
      : [],
    projectIds.length
      ? db
          .select({ id: domains.id, projectId: domains.projectId, name: domains.name })
          .from(domains)
          .where(inArray(domains.projectId, projectIds))
      : [],
    projectIds.length
      ? db
          .select({
            id: strategicDecisions.id,
            projectId: strategicDecisions.projectId,
            title: strategicDecisions.title,
            status: strategicDecisions.status,
            createdAt: strategicDecisions.createdAt,
          })
          .from(strategicDecisions)
          .where(
            and(
              inArray(strategicDecisions.projectId, projectIds),
              isNull(strategicDecisions.deletedAt)
            )
          )
          .orderBy(desc(strategicDecisions.createdAt))
          .limit(8)
      : [],
    projectIds.length > 0 && projectIds.length <= LIMIT_HEALTH
      ? Promise.all(
          projectIds.map((id) =>
            computeProjectHealth(id)
              .then((h) => [id, h.score] as const)
              .catch(() => [id, null] as const)
          )
        )
      : [],
    Promise.all(
      plaskie
        .filter((p) => p.strategyMode === "dziedziczona")
        .map(async (p) => [p.id, await resolveFoundationSource(p.id)] as const)
    ),
  ]);

  const health = new Map(zdrowie);
  const fundament = new Map(zrodlaFundamentu);
  const nazwyProjektow = new Map(plaskie.map((p) => [p.id, p.name]));

  const wgRodzaju = {
    firma: plaskie.filter((p) => p.kind === "firma").length,
    galaz: plaskie.filter((p) => p.kind === "galaz").length,
    produkt: plaskie.filter((p) => p.kind === "produkt").length,
  };
  const dziedziczace = plaskie.filter((p) => p.strategyMode === "dziedziczona");
  const zerwaneLancuchy = dziedziczace.filter((p) => fundament.get(p.id)?.brokenChain);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {organization.name}
            </h1>
            {role === "owner" && (
              <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                <ShieldCheck className="size-2.5" />
                Właściciel
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Podsumowanie organizacji — wszystkie projekty, strony i decyzje w jednym miejscu.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/strategy-hub">Lista projektów</Link>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kafel
          ikona={Building2}
          etykieta="Projekty"
          wartosc={plaskie.length}
          opis={`${wgRodzaju.firma} firma · ${wgRodzaju.galaz} gałąź · ${wgRodzaju.produkt} produkt`}
        />
        <Kafel
          ikona={Globe}
          etykieta="Strony WWW"
          wartosc={strony.length}
          opis={`${domeny.length} ${domeny.length === 1 ? "domena" : "domen"}`}
        />
        <Kafel
          ikona={Link2}
          etykieta="Dziedziczą fundament"
          wartosc={dziedziczace.length}
          opis={
            zerwaneLancuchy.length > 0
              ? `${zerwaneLancuchy.length} z zerwanym łańcuchem`
              : "łańcuchy spójne"
          }
          alarm={zerwaneLancuchy.length > 0}
        />
        <Kafel
          ikona={ScrollText}
          etykieta="Decyzje"
          wartosc={decyzje.length}
          opis="ostatnie w organizacji"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Drzewo organizacji</h2>
        {plaskie.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
            Brak projektów w tej organizacji.
          </p>
        ) : (
          <div className="space-y-2">
            {drzewo.map((w) => (
              <WezelDrzewa
                key={w.id}
                wezel={w}
                poziom={0}
                health={health}
                fundament={fundament}
                nazwy={nazwyProjektow}
              />
            ))}
            {projectIds.length > LIMIT_HEALTH && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                Health-score pominięty: organizacja ma ponad {LIMIT_HEALTH} projektów,
                a liczenie go dla wszystkich naraz spowolniłoby ten widok. Wynik dla
                pojedynczego projektu jest na jego stronie.
              </p>
            )}
          </div>
        )}
      </section>

      {strony.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Strony i domeny</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {strony.map((s) => (
              <Link
                key={s.id}
                href={`/strategy-hub/projects/${s.projectId}/execution/sites`}
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-muted/40"
              >
                <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                {s.domain && (
                  <span className="hidden shrink-0 truncate text-muted-foreground sm:block">
                    {s.domain}
                  </span>
                )}
                <span className="shrink-0 text-muted-foreground">
                  {nazwyProjektow.get(s.projectId)}
                </span>
                {s.isPrimary && (
                  <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
                    główna
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {decyzje.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Ostatnie decyzje strategiczne</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {decyzje.map((d) => (
              <Link
                key={d.id}
                href={`/strategy-hub/projects/${d.projectId}/foundation/decisions`}
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-muted/40"
              >
                <ScrollText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {nazwyProjektow.get(d.projectId)}
                </span>
                <span className="hidden shrink-0 text-muted-foreground sm:block">
                  {new Date(d.createdAt).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WezelDrzewa({
  wezel,
  poziom,
  health,
  fundament,
  nazwy,
}: {
  wezel: ProjectTreeNode;
  poziom: number;
  health: Map<string, number | null>;
  fundament: Map<string, Awaited<ReturnType<typeof resolveFoundationSource>>>;
  nazwy: Map<string, string>;
}) {
  const KindIcon = KIND_ICONS[wezel.kind] ?? Building2;
  const score = health.get(wezel.id);
  const zrodlo = fundament.get(wezel.id);

  return (
    <div className={poziom > 0 ? "ml-4 border-l border-border pl-4" : undefined}>
      <Link
        href={`/strategy-hub/projects/${wezel.id}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-brand/40"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm">
          {wezel.icon ?? "🏢"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{wezel.name}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <KindIcon className="size-2.5" />
              {KIND_LABELS[wezel.kind] ?? wezel.kind}
            </span>
            {wezel.strategyMode === "dziedziczona" && (
              <span className="flex items-center gap-1 text-brand/80">
                <Link2 className="size-2.5" />
                {zrodlo?.brokenChain
                  ? "łańcuch zerwany"
                  : `fundament z: ${nazwy.get(zrodlo?.projectId ?? "") ?? zrodlo?.sourceName ?? "?"}`}
              </span>
            )}
          </span>
        </span>
        {typeof score === "number" && (
          <span className="shrink-0 text-xs font-medium tabular-nums">
            {score}
            <span className="text-[10px] text-muted-foreground">/100</span>
          </span>
        )}
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand" />
      </Link>
      {wezel.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {wezel.children.map((d) => (
            <WezelDrzewa
              key={d.id}
              wezel={d}
              poziom={poziom + 1}
              health={health}
              fundament={fundament}
              nazwy={nazwy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Kafel({
  ikona: Ikona,
  etykieta,
  wartosc,
  opis,
  alarm,
}: {
  ikona: typeof Building2;
  etykieta: string;
  wartosc: number;
  opis: string;
  alarm?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Ikona className="size-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{etykieta}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{wartosc}</p>
      <p
        className={
          alarm
            ? "mt-0.5 text-[11px] text-destructive"
            : "mt-0.5 text-[11px] text-muted-foreground"
        }
      >
        {opis}
      </p>
    </div>
  );
}
