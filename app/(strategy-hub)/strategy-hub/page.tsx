import Link from "next/link";
import {
  Plus,
  ArrowRight,
  Globe,
  Calendar,
  RefreshCw,
  Building2,
  GitBranch,
  Package,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  requireStrategyHubAccess,
  getCurrentOrganizationForAdmin,
} from "@/lib/strategy-hub/context";
import { getProjectTree, type ProjectTreeNode } from "@/lib/strategy-hub/scope";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktywny",
  paused: "Wstrzymany",
  completed: "Zakończony",
  archived: "Archiwum",
};

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  archived: "secondary",
};

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

function policzWezly(wezly: ProjectTreeNode[]): number {
  return wezly.reduce((n, w) => n + 1 + policzWezly(w.children), 0);
}

export default async function StrategyHubPage() {
  const access = await requireStrategyHubAccess();
  const organization = await getCurrentOrganizationForAdmin(access.session.email);
  const drzewo = await getProjectTree(organization.id);
  const liczba = policzWezly(drzewo);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {organization.name}
            </h1>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Organizacja
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {liczba === 0
              ? "Brak projektów. Utwórz pierwszy."
              : `${liczba} ${projektySuffix(liczba)} w tej organizacji`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/strategy-hub/org/${organization.id}`}>
              Podsumowanie
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-brand hover:bg-brand/90 text-white gap-1.5"
          >
            <Link href="/strategy-hub/projects/new">
              <Plus className="size-4" />
              Nowy projekt
            </Link>
          </Button>
        </div>
      </div>

      {liczba === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {drzewo.map((wezel) => (
            <GalazDrzewa key={wezel.id} wezel={wezel} poziom={0} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Jedna gałąź drzewa: projekt + wcięte dzieci. Wcięcie robimy paddingiem
 * z pionową linią zamiast zagnieżdżonych gridów — dzięki temu karta ma tę samą
 * szerokość niezależnie od poziomu i nie ucieka poza kolumnę.
 */
function GalazDrzewa({
  wezel,
  poziom,
}: {
  wezel: ProjectTreeNode;
  poziom: number;
}) {
  return (
    <div className={poziom > 0 ? "border-l border-border pl-4 ml-4" : undefined}>
      <ProjectCard project={wezel} />
      {wezel.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {wezel.children.map((dziecko) => (
            <GalazDrzewa key={dziecko.id} wezel={dziecko} poziom={poziom + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectTreeNode }) {
  const KindIcon = KIND_ICONS[project.kind] ?? Building2;

  return (
    <Link
      href={`/strategy-hub/projects/${project.id}`}
      className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 hover:border-brand/40 hover:bg-card/80 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
            {project.icon ?? "🏢"}
          </div>
          <div className="min-w-0">
            <h2 className="font-medium text-sm leading-tight truncate">
              {project.name}
            </h2>
            {project.clientName && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {project.clientName}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 text-[10px] px-1.5 h-4 font-normal"
          >
            <KindIcon className="size-2.5" />
            {KIND_LABELS[project.kind] ?? project.kind}
          </Badge>
          <Badge
            variant={STATUS_COLORS[project.status] ?? "secondary"}
            className="text-[10px] px-1.5 h-4"
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {project.strategyMode === "dziedziczona" && (
          <span className="flex items-center gap-1 shrink-0 text-brand/80">
            <Link2 className="size-3" />
            Fundament dziedziczony
          </span>
        )}
        {project.domain && (
          <span className="flex items-center gap-1 truncate">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">{project.domain}</span>
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto shrink-0">
          <Calendar className="size-3" />
          {new Date(project.updatedAt).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      <ArrowRight className="absolute right-4 bottom-4 size-4 text-muted-foreground/0 group-hover:text-brand transition-all duration-200 translate-x-0 group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
      <div className="size-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
        <Globe className="size-6 text-brand" />
      </div>
      <h3 className="font-medium text-sm mb-1">Brak projektów</h3>
      <p className="text-xs text-muted-foreground mb-5 max-w-xs">
        Utwórz pierwszy projekt w tej organizacji — całą firmę, jej gałąź albo
        pojedynczy produkt. Możesz też zaimportować strukturę z Notion.
      </p>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
          <Link href="/strategy-hub/projects/new">
            <Plus className="size-4" />
            Nowy projekt
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/strategy-hub/sync">
            <RefreshCw className="size-4" />
            Zaimportuj z Notion
          </Link>
        </Button>
      </div>
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
