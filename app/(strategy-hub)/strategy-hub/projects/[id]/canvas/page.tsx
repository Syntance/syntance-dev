import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LayoutDashboard,
  Fingerprint,
  Crosshair,
  Users,
  Filter,
  Radio,
  FileText,
  Target,
  Globe,
  ClipboardCheck,
  RefreshCw,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Milestone,
  Handshake,
} from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { getCanvasData } from "@/lib/strategy-hub/canvas-data";
import {
  computeProjectCoverage,
  coverageRatio,
} from "@/lib/strategy-hub/journey-coverage";
import { pluralCount } from "@/lib/strategy-hub/pluralize";
import { PositioningMini } from "@/components/strategy-hub/positioning-mini";
import { HealthRing } from "@/components/strategy-hub/health-ring";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Strategy Canvas · ${rows[0]?.name ?? "Projekt"}` };
}

type TileStatus = "complete" | "partial" | "empty";

const STATUS_META: Record<TileStatus, { dot: string; label: string }> = {
  complete: { dot: "bg-success", label: "Kompletne" },
  partial: { dot: "bg-brand", label: "W toku" },
  empty: { dot: "bg-muted-foreground/40", label: "Brak" },
};

function statusFrom(value: number, partialAt = 1): TileStatus {
  if (value <= 0) return "empty";
  if (value < partialAt) return "partial";
  return "complete";
}

function firstLine(md: string | null, max = 90): string | null {
  if (!md) return null;
  const line = md.split("\n").find((l) => l.trim().length > 0)?.trim();
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function Tile({
  href,
  icon: Icon,
  title,
  status,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: TileStatus;
  children?: React.ReactNode;
}) {
  const meta = STATUS_META[status];
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-4 hover:border-brand/40 transition-colors min-h-[148px]"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-brand" />
        <span className="text-sm font-medium">{title}</span>
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
          title={meta.label}
        >
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
      <ArrowRight className="absolute bottom-3 right-3 size-3.5 text-muted-foreground/0 group-hover:text-brand transition-colors" />
    </Link>
  );
}

export default async function CanvasPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) notFound();

  const [health, data, journey] = await Promise.all([
    computeProjectHealth(id),
    getCanvasData(id),
    computeProjectCoverage(id),
  ]);

  // Statusy kafli lejka/podróży/sprzedaży z gap engine — nie z liczby rekordów
  // (audyt 2026-07-17: „Kompletne” przy 11 lukach podważało wiarygodność).
  const funnelStatus: TileStatus =
    journey.stageCount === 0
      ? "empty"
      : journey.gapCount === 0
        ? "complete"
        : "partial";
  const journeyStatus: TileStatus =
    journey.segments.length === 0 || journey.stageCount === 0
      ? "empty"
      : journey.segmentsWithoutJourney.length === 0
        ? "complete"
        : "partial";
  const salesCoveragePct = Math.round(coverageRatio(journey, ["sales"]) * 100);
  const salesStatus: TileStatus =
    journey.stageCount === 0 && data.sales.activities === 0
      ? "empty"
      : salesCoveragePct >= 100 && data.sales.activities > 0
        ? "complete"
        : data.sales.activities > 0 || salesCoveragePct > 0
          ? "partial"
          : "empty";
  const segmentsStatus: TileStatus =
    data.segments.total === 0
      ? "empty"
      : journey.segmentsWithoutJourney.length === 0
        ? "complete"
        : "partial";

  const base = `/strategy-hub/projects/${id}`;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Strategy Canvas</h1>
        </div>
        <div className="flex items-center gap-3">
          <HealthRing score={health.score} />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Kondycja strategii</p>
            <p className="text-sm font-medium tabular-nums">{health.score}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* 1 — Marka */}
        <Tile
          href={`${base}/foundation/brand`}
          icon={Fingerprint}
          title="Marka"
          status={statusFrom(
            (data.brand.missionMd ? 1 : 0) + data.brand.colors.length,
            2
          )}
        >
          <p className="text-xs text-muted-foreground line-clamp-2">
            {firstLine(data.brand.missionMd) ?? "Brak misji — uzupełnij tożsamość."}
          </p>
          {data.brand.colors.length > 0 && (
            <div className="flex gap-1 mt-2">
              {data.brand.colors.map((c, i) => (
                <span
                  key={`${c.value}-${i}`}
                  className="size-4 rounded-full border border-border/50"
                  style={{ backgroundColor: c.value }}
                  title={c.name ?? c.value}
                />
              ))}
            </div>
          )}
          {data.brand.toneOfVoiceMd && (
            <span className="inline-block mt-2 text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              ToV ustalony
            </span>
          )}
        </Tile>

        {/* 2 — Pozycjonowanie */}
        <Tile
          href={`${base}/foundation/business`}
          icon={Crosshair}
          title="Pozycjonowanie"
          status={
            data.positioning.statementMd?.trim()
              ? "complete"
              : data.positioning.ourX !== null
                ? "partial"
                : "empty"
          }
        >
          <div className="flex items-center gap-2">
            <div className="size-[88px] text-muted-foreground shrink-0">
              <PositioningMini
                ourX={data.positioning.ourX}
                ourY={data.positioning.ourY}
                ourLabel={data.positioning.ourLabel}
                competitors={data.positioning.competitors}
                className="w-full h-full"
              />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-4">
              {firstLine(data.positioning.statementMd, 120) ??
                "Brak statementu pozycjonowania — „jesteśmy X dla Y, w przeciwieństwie do W”."}
            </p>
          </div>
          {data.positioning.nicheMd?.trim() && (
            <span className="inline-block mt-2 text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              Nisza zdefiniowana
            </span>
          )}
        </Tile>

        {/* 3 — Segmenty */}
        <Tile
          href={`${base}/market/segments`}
          icon={Users}
          title="Segmenty"
          status={segmentsStatus}
        >
          {data.segments.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak segmentów.</p>
          ) : (
            <ul className="space-y-1">
              {data.segments.items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">{s.name}</span>
                  {s.revenueSharePct != null && (
                    <span className="tabular-nums text-muted-foreground">
                      {s.revenueSharePct}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* 4 — Podróż zakupowa (kręgosłup strategii) */}
        <Tile
          href={`${base}/market/journey`}
          icon={Milestone}
          title="Podróż zakupowa"
          status={journeyStatus}
        >
          {journey.stageCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              Brak etapów podróży — z nich wynikają lejek, sprzedaż i pomiar.
            </p>
          ) : (
            <>
              <div className="flex gap-4">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {journey.stageCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {pluralCount(journey.stageCount, "etap", "etapy", "etapów").replace(/^\d+\s/, "")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {journey.gapCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {pluralCount(journey.gapCount, "luka", "luki", "luk").replace(/^\d+\s/, "")}
                  </p>
                </div>
              </div>
              {journey.segmentsWithoutJourney.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {pluralCount(
                    journey.segmentsWithoutJourney.length,
                    "segment bez podróży",
                    "segmenty bez podróży",
                    "segmentów bez podróży"
                  )}
                </p>
              )}
            </>
          )}
        </Tile>

        {/* 5 — Lejek */}
        <Tile
          href={`${base}/execution/funnel`}
          icon={Filter}
          title="Lejek"
          status={funnelStatus}
        >
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.funnel.elements}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {pluralCount(data.funnel.elements, "element", "elementy", "elementów").replace(/^\d+\s/, "")}
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {Math.round(coverageRatio(journey, ["content", "exit"]) * 100)}%
              </p>
              <p className="text-[11px] text-muted-foreground">pokrycia etapów</p>
            </div>
          </div>
          {journey.gapCount > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {pluralCount(journey.gapCount, "luka", "luki", "luk")} w gap engine
            </p>
          )}
        </Tile>

        {/* 6 — Proces sprzedaży */}
        <Tile
          href={`${base}/execution/sales`}
          icon={Handshake}
          title="Proces sprzedaży"
          status={salesStatus}
        >
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.sales.activities}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {pluralCount(data.sales.activities, "akcja handlowa", "akcje handlowe", "akcji handlowych").replace(/^\d+\s/, "")}
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {salesCoveragePct}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                etapów sprzedażowych z akcją
              </p>
            </div>
          </div>
        </Tile>

        {/* 5 — Mapa kanałów */}
        <Tile
          href={`${base}/execution/channels`}
          icon={Radio}
          title="Mapa kanałów"
          status={statusFrom(data.channels.total)}
        >
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.channels.total}
              </p>
              <p className="text-[11px] text-muted-foreground">kanałów</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.channels.activities}
              </p>
              <p className="text-[11px] text-muted-foreground">aktywności</p>
            </div>
          </div>
        </Tile>

        {/* 6 — Materiały */}
        <Tile
          href={`${base}/execution/copy`}
          icon={FileText}
          title="Materiały"
          status={statusFrom(
            data.materials.pitches + data.materials.scripts + data.materials.leadMagnets
          )}
        >
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex justify-between">
              <span>Pitche</span>
              <span className="tabular-nums">{data.materials.pitches}</span>
            </li>
            <li className="flex justify-between">
              <span>Skrypty</span>
              <span className="tabular-nums">{data.materials.scripts}</span>
            </li>
            <li className="flex justify-between">
              <span>Lead magnety</span>
              <span className="tabular-nums">{data.materials.leadMagnets}</span>
            </li>
          </ul>
        </Tile>

        {/* 7 — KPI */}
        <Tile
          href={`${base}/measurement/kpi`}
          icon={Target}
          title="KPI"
          status={statusFrom(data.kpis.total)}
        >
          {data.kpis.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak wskaźników.</p>
          ) : (
            <ul className="space-y-1">
              {data.kpis.items.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">{k.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {k.actual ?? "—"}
                    {k.target ? ` / ${k.target}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* 8 — Strona */}
        <Tile
          href={`${base}/execution/sites`}
          icon={Globe}
          title="Strona"
          status={statusFrom(data.website.pages)}
        >
          <p className="text-2xl font-semibold tabular-nums">
            {data.website.pages}
          </p>
          <p className="text-[11px] text-muted-foreground">podstron w mapie serwisu</p>
        </Tile>

        {/* 9 — Audyt */}
        <Tile
          href={`${base}/measurement/audits`}
          icon={ClipboardCheck}
          title="Audyt"
          status={data.audit.findings > 0 ? "partial" : "empty"}
        >
          {data.audit.findings === 0 ? (
            <p className="text-xs text-muted-foreground">Brak findings.</p>
          ) : (
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                {data.audit.high} high
              </span>
              <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5">
                {data.audit.medium} med
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {data.audit.low} low
              </span>
            </div>
          )}
        </Tile>

        {/* 10 — Sync */}
        <Tile
          href={`${base}/project-settings/sync`}
          icon={RefreshCw}
          title="Sync"
          status={data.sync.lastSyncedAt ? "complete" : "empty"}
        >
          <p className="text-xs text-muted-foreground">
            {data.sync.lastSyncedAt
              ? `Ostatni sync: ${data.sync.lastSyncedAt.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}`
              : "Brak synchronizacji z Notion."}
          </p>
        </Tile>

        {/* 11 — Discovery */}
        <Tile
          href={`${base}/foundation/discovery`}
          icon={HelpCircle}
          title="Discovery"
          status={
            data.discovery.openQuestions + data.discovery.openTasks > 0
              ? "partial"
              : "complete"
          }
        >
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.discovery.openQuestions}
              </p>
              <p className="text-[11px] text-muted-foreground">otwartych pytań</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.discovery.openTasks}
              </p>
              <p className="text-[11px] text-muted-foreground">zadań do zrobienia</p>
            </div>
          </div>
        </Tile>

        {/* 12 — AI sugestie */}
        <Tile
          href={`${base}/chat`}
          icon={Sparkles}
          title="AI sugestie"
          status={data.ai.recent > 0 ? "partial" : "empty"}
        >
          <p className="text-xs text-muted-foreground">
            Asystent AI w kontekście projektu — propozycje segmentów, lejka, dowodów
            i analiz spójności.
          </p>
          <span className="inline-block mt-2 text-[10px] rounded-full bg-brand/10 text-brand px-2 py-0.5">
            Otwórz czat AI
          </span>
        </Tile>
      </div>
    </div>
  );
}
