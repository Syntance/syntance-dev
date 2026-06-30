"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Play,
  Square,
  Plus,
  List,
  BarChart3,
  Trash2,
  Loader2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  SummaryResult,
  TimeEntryRow,
  WorkType,
} from "@/lib/strategy-hub/time-tracking-types";
import { WORK_TYPE_LABELS } from "@/lib/strategy-hub/time-tracking-types";
import {
  WorkTypeBadge,
  WorkTypeSelector,
} from "@/components/strategy-hub/apps/work-type-selector";
import {
  DateTimeField,
  dateTimeValueToIso,
  formatDateTime24,
  toDateTimeValue,
  type DateTimeValue,
} from "@/components/strategy-hub/apps/datetime-field";
import {
  CustomSelect,
  DatePickerField,
} from "@/components/strategy-hub/apps/custom-pickers";

interface ProjectOption {
  id: string;
  name: string;
  icon: string | null;
  hourlyRateDevelopment?: number | null;
  hourlyRateMaintenance?: number | null;
}

type TabKey = "timer" | "list" | "summary";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatPln(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amount);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TABS: {
  key: TabKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "timer",
    label: "Timer",
    description: "Start, stop i wpisy ręczne",
    icon: Clock,
  },
  {
    key: "list",
    label: "Lista wpisów",
    description: "Historia z datami i zadaniami",
    icon: List,
  },
  {
    key: "summary",
    label: "Podsumowanie",
    description: "Godziny, stawka i kwota",
    icon: BarChart3,
  },
];

export function TimeTrackingApp() {
  const [tab, setTab] = useState<TabKey>("timer");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntryRow | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [timerComment, setTimerComment] = useState("");
  const [devRateInput, setDevRateInput] = useState("");
  const [maintenanceRateInput, setMaintenanceRateInput] = useState("");

  const [manualStart, setManualStart] = useState<DateTimeValue>(() =>
    toDateTimeValue()
  );
  const [manualEnd, setManualEnd] = useState<DateTimeValue>(() =>
    toDateTimeValue()
  );
  const [manualComment, setManualComment] = useState("");
  const [workType, setWorkType] = useState<WorkType>("development");

  const [summaryFrom, setSummaryFrom] = useState(monthStart());
  const [summaryTo, setSummaryTo] = useState(todayIso());
  const [summaryProjectId, setSummaryProjectId] = useState("");

  const [listProjectId, setListProjectId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editWorkType, setEditWorkType] = useState<WorkType>("development");
  const [editStart, setEditStart] = useState<DateTimeValue>(() =>
    toDateTimeValue()
  );
  const [editEnd, setEditEnd] = useState<DateTimeValue>(() =>
    toDateTimeValue()
  );
  const [editComment, setEditComment] = useState("");

  const [tick, setTick] = useState(0);

  const todayMinutes = useMemo(() => {
    const today = todayIso();
    return entries
      .filter((e) => e.startedAt.slice(0, 10) === today)
      .reduce((sum, e) => {
        if (e.durationMinutes != null) return sum + e.durationMinutes;
        if (e.id === activeEntry?.id) {
          const mins = Math.round(
            (Date.now() - new Date(e.startedAt).getTime()) / 60_000
          );
          return sum + mins;
        }
        return sum;
      }, 0);
  }, [entries, activeEntry, tick]);

  const monthMinutes = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return entries
      .filter((e) => e.startedAt.slice(0, 7) === month)
      .reduce((sum, e) => {
        if (e.durationMinutes != null) return sum + e.durationMinutes;
        if (e.id === activeEntry?.id) {
          const mins = Math.round(
            (Date.now() - new Date(e.startedAt).getTime()) / 60_000
          );
          return sum + mins;
        }
        return sum;
      }, 0);
  }, [entries, activeEntry, tick]);

  const activeElapsed = useMemo(() => {
    if (!activeEntry) return 0;
    return Math.round(
      (Date.now() - new Date(activeEntry.startedAt).getTime()) / 60_000
    );
  }, [activeEntry, tick]);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/strategy-hub/projects");
    if (!res.ok) return;
    const data = (await res.json()) as { projects: ProjectOption[] };
    setProjects(data.projects);
    if (data.projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data.projects[0].id);
    }
  }, [selectedProjectId]);

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (listProjectId) params.set("projectId", listProjectId);

    const [listRes, activeRes] = await Promise.all([
      fetch(`/api/strategy-hub/time-tracking?${params}`),
      fetch("/api/strategy-hub/time-tracking?active=true"),
    ]);

    if (listRes.ok) {
      const data = (await listRes.json()) as { entries: TimeEntryRow[] };
      setEntries(data.entries);
    }

    if (activeRes.ok) {
      const data = (await activeRes.json()) as { entries: TimeEntryRow[] };
      setActiveEntry(data.entries[0] ?? null);
    }
  }, [listProjectId]);

  const loadSummary = useCallback(async () => {
    const params = new URLSearchParams({
      from: summaryFrom,
      to: summaryTo,
    });
    if (summaryProjectId) params.set("projectId", summaryProjectId);

    const res = await fetch(
      `/api/strategy-hub/time-tracking/summary?${params}`
    );
    if (res.ok) {
      setSummary((await res.json()) as SummaryResult);
    }
  }, [summaryFrom, summaryTo, summaryProjectId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadProjects();
      await loadEntries();
      setLoading(false);
    })();
  }, [loadProjects, loadEntries]);

  useEffect(() => {
    if (tab === "summary") void loadSummary();
  }, [tab, loadSummary]);

  useEffect(() => {
    if (tab === "list") void loadEntries();
  }, [tab, listProjectId, loadEntries]);

  useEffect(() => {
    if (!activeEntry) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [activeEntry]);

  useEffect(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    setDevRateInput(
      project?.hourlyRateDevelopment != null
        ? String(project.hourlyRateDevelopment)
        : ""
    );
    setMaintenanceRateInput(
      project?.hourlyRateMaintenance != null
        ? String(project.hourlyRateMaintenance)
        : ""
    );
  }, [selectedProjectId, projects]);

  async function saveHourlyRates() {
    if (!selectedProjectId) return;
    setActionLoading(true);
    setError("");
    try {
      const devRate =
        devRateInput.trim() === "" ? null : Number(devRateInput);
      const maintenanceRate =
        maintenanceRateInput.trim() === "" ? null : Number(maintenanceRateInput);

      if (
        (devRate != null && Number.isNaN(devRate)) ||
        (maintenanceRate != null && Number.isNaN(maintenanceRate))
      ) {
        setError("Podaj poprawne stawki (liczby ≥ 0).");
        return;
      }

      const res = await fetch(
        `/api/strategy-hub/projects/${selectedProjectId}/hourly-rate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hourlyRateDevelopment: devRate,
            hourlyRateMaintenance: maintenanceRate,
          }),
        }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nie udało się zapisać stawek");
        return;
      }
      await loadProjects();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    if (!selectedProjectId) {
      setError("Wybierz projekt");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/strategy-hub/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          projectId: selectedProjectId,
          workType,
          comment: timerComment || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nie udało się uruchomić timera");
        return;
      }
      setTimerComment("");
      await loadEntries();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/strategy-hub/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          comment: timerComment || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zatrzymać timera");
        return;
      }
      setTimerComment("");
      await loadEntries();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Wybierz projekt");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/strategy-hub/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          projectId: selectedProjectId,
          workType,
          startedAt: dateTimeValueToIso(manualStart),
          endedAt: dateTimeValueToIso(manualEnd),
          comment: manualComment || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nie udało się dodać wpisu");
        return;
      }
      setManualComment("");
      await loadEntries();
    } finally {
      setActionLoading(false);
    }
  }

  function openEditEntry(entry: TimeEntryRow) {
    setEditingEntry(entry);
    setEditProjectId(entry.projectId);
    setEditWorkType(entry.workType);
    setEditStart(toDateTimeValue(new Date(entry.startedAt)));
    setEditEnd(
      entry.endedAt
        ? toDateTimeValue(new Date(entry.endedAt))
        : toDateTimeValue()
    );
    setEditComment(entry.comment ?? "");
    setEditOpen(true);
  }

  function closeEditEntry() {
    setEditOpen(false);
    setEditingEntry(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editProjectId) {
      setError("Wybierz projekt");
      return;
    }

    const isActive = activeEntry?.id === editingEntry.id;
    const startedAt = dateTimeValueToIso(editStart);
    const endedAtIso = isActive ? null : dateTimeValueToIso(editEnd);

    if (endedAtIso && new Date(endedAtIso) <= new Date(startedAt)) {
      setError("Godzina zakończenia musi być późniejsza niż rozpoczęcia.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/strategy-hub/time-tracking/${editingEntry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: editProjectId,
            workType: editWorkType,
            comment: editComment.trim() === "" ? null : editComment.trim(),
            startedAt,
            ...(endedAtIso ? { endedAt: endedAtIso } : {}),
          }),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zapisać zmian");
        return;
      }
      closeEditEntry();
      await loadEntries();
      if (tab === "summary") await loadSummary();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(entryId: string) {
    if (!window.confirm("Usunąć ten wpis?")) return;
    await fetch(`/api/strategy-hub/time-tracking/${entryId}`, {
      method: "DELETE",
    });
    await loadEntries();
    if (tab === "summary") await loadSummary();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Ładowanie…
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Custom Apps</p>
        <h1 className="text-2xl font-semibold tracking-tight">Liczenie godzin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Śledź czas pracy nad projektami — timer, wpisy ręczne i rozliczenia.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Dziś" value={formatDuration(todayMinutes)} />
        <StatCard label="Ten miesiąc" value={formatDuration(monthMinutes)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
              tab === t.key
                ? "border-brand/40 bg-brand/5 shadow-[var(--brand-glow)]"
                : "border-border bg-card/40 hover:border-border/80 hover:bg-card/70"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  tab === t.key
                    ? "bg-brand/15 text-brand"
                    : "bg-muted/60 text-muted-foreground group-hover:text-foreground"
                )}
              >
                <t.icon className="size-4" />
              </div>
              <span className="text-sm font-medium">{t.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug pl-[2.625rem]">
              {t.description}
            </p>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === "timer" && (
        <div className="space-y-4">
          <Card title="Timer">
            {activeEntry ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-brand">
                    Aktywny
                  </Badge>
                  <WorkTypeBadge workType={activeEntry.workType} />
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatDuration(activeElapsed)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeEntry.projectIcon} {activeEntry.projectName} · od{" "}
                  {formatDateTime24(activeEntry.startedAt)}
                </p>
                <Textarea
                  placeholder="Co robisz? (opcjonalnie — zapisze się przy stopie)"
                  value={timerComment}
                  onChange={(e) => setTimerComment(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={handleStop}
                  disabled={actionLoading}
                  variant="destructive"
                  className="gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Square className="size-4" />
                  )}
                  Zatrzymaj pracę
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <CustomSelect
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    icon: p.icon,
                  }))}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  label="Projekt"
                  placeholder="Wybierz projekt…"
                />
                <WorkTypeSelector value={workType} onChange={setWorkType} />
                <Textarea
                  placeholder="Co planujesz zrobić?"
                  value={timerComment}
                  onChange={(e) => setTimerComment(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={handleStart}
                  disabled={actionLoading || projects.length === 0}
                  className="bg-brand hover:bg-brand/90 text-white gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Start pracy
                </Button>
              </div>
            )}
          </Card>

          <Card title="Stawki godzinowe klienta">
            <div className="flex flex-wrap items-end gap-3">
              <CustomSelect
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  icon: p.icon,
                }))}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                label="Projekt"
                placeholder="Wybierz projekt…"
                className="min-w-[200px]"
              />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Development · PLN / h
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={devRateInput}
                  onChange={(e) => setDevRateInput(e.target.value)}
                  placeholder="np. 150"
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Utrzymanie · PLN / h
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={maintenanceRateInput}
                  onChange={(e) => setMaintenanceRateInput(e.target.value)}
                  placeholder="np. 100"
                  className="w-32"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={saveHourlyRates}
                disabled={actionLoading || !selectedProjectId}
              >
                Zapisz stawki
              </Button>
            </div>
          </Card>

          <Card title="Ręczny wpis">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <CustomSelect
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  icon: p.icon,
                }))}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                label="Projekt"
                placeholder="Wybierz projekt…"
              />
              <WorkTypeSelector value={workType} onChange={setWorkType} />
              <div className="grid gap-4 sm:grid-cols-2">
                <DateTimeField
                  label="Start"
                  value={manualStart}
                  onChange={setManualStart}
                />
                <DateTimeField
                  label="Koniec"
                  value={manualEnd}
                  onChange={setManualEnd}
                />
              </div>
              <Textarea
                placeholder="Co zrobiłeś?"
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                rows={3}
              />
              <Button type="submit" variant="outline" disabled={actionLoading} className="gap-2">
                <Plus className="size-4" />
                Dodaj wpis
              </Button>
            </form>
          </Card>
        </div>
      )}

      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <CustomSelect
              options={[
                { value: "", label: "Wszystkie projekty" },
                ...projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  icon: p.icon,
                })),
              ]}
              value={listProjectId}
              onChange={setListProjectId}
              label="Filtr projektu"
              placeholder="Wszystkie projekty"
              className="min-w-[220px]"
            />
            <Button variant="outline" size="sm" onClick={() => void loadEntries()}>
              Odśwież
            </Button>
          </div>

          {entries.length === 0 ? (
            <Card title="Brak wpisów">
              <p className="text-sm text-muted-foreground">
                Uruchom timer lub dodaj ręczny wpis, żeby zobaczyć historię.
              </p>
            </Card>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Projekt</th>
                      <th className="px-4 py-3 font-medium">Typ</th>
                      <th className="px-4 py-3 font-medium">Start</th>
                      <th className="px-4 py-3 font-medium">Koniec</th>
                      <th className="px-4 py-3 font-medium">Czas</th>
                      <th className="px-4 py-3 font-medium">Zadanie / komentarz</th>
                      <th className="px-4 py-3 font-medium w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const mins =
                        entry.durationMinutes ??
                        (entry.id === activeEntry?.id ? activeElapsed : null);
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="mr-1">{entry.projectIcon ?? "🏢"}</span>
                            {entry.projectName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <WorkTypeBadge workType={entry.workType} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {formatDateTime24(entry.startedAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {entry.endedAt
                              ? formatDateTime24(entry.endedAt)
                              : entry.id === activeEntry?.id
                                ? "— trwa —"
                                : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">
                            {mins != null ? formatDuration(mins) : "—"}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                            {entry.comment || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => openEditEntry(entry)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                aria-label="Edytuj wpis"
                              >
                                <Pencil className="size-4" />
                              </button>
                              {!activeEntry || entry.id !== activeEntry.id ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(entry.id)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  aria-label="Usunąć wpis"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "summary" && (
        <div className="space-y-4">
          <Card title="Filtry">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Od</span>
                <DatePickerField
                  value={summaryFrom}
                  onChange={setSummaryFrom}
                  compact
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Do</span>
                <DatePickerField
                  value={summaryTo}
                  onChange={setSummaryTo}
                  compact
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <CustomSelect
                  options={[
                    { value: "", label: "Wszystkie projekty" },
                    ...projects.map((p) => ({
                      value: p.id,
                      label: p.name,
                      icon: p.icon,
                    })),
                  ]}
                  value={summaryProjectId}
                  onChange={setSummaryProjectId}
                  label="Projekt"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadSummary()}
            >
              Przelicz
            </Button>
          </Card>

          {summary && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Łącznie godzin"
                  value={`${(summary.totalMinutes / 60).toFixed(2)} h`}
                />
                <StatCard
                  label="Stawka · development"
                  value={
                    summary.hourlyRates.development != null
                      ? formatPln(summary.hourlyRates.development) + " / h"
                      : "—"
                  }
                />
                <StatCard
                  label="Stawka · utrzymanie"
                  value={
                    summary.hourlyRates.maintenance != null
                      ? formatPln(summary.hourlyRates.maintenance) + " / h"
                      : "—"
                  }
                />
                <StatCard
                  label="Kwota łącznie"
                  value={
                    summary.totalAmount != null
                      ? formatPln(summary.totalAmount)
                      : "—"
                  }
                  highlight
                />
              </div>

              <Card title="Development vs utrzymanie">
                <div className="grid gap-3 sm:grid-cols-2">
                  {summary.byWorkType.map((block) => (
                    <div
                      key={block.workType}
                      className={cn(
                        "rounded-xl border p-4 space-y-3",
                        block.workType === "development"
                          ? "border-brand/25 bg-brand/5"
                          : "border-amber-500/25 bg-amber-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <WorkTypeBadge workType={block.workType} />
                        <span className="text-xs text-muted-foreground">
                          {block.entryCount}{" "}
                          {block.entryCount === 1 ? "wpis" : "wpisy"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Godziny</p>
                          <p className="font-semibold tabular-nums">
                            {block.hours.toFixed(2)} h
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDuration(block.minutes)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Stawka</p>
                          <p className="font-semibold tabular-nums">
                            {block.hourlyRate != null
                              ? formatPln(block.hourlyRate) + " / h"
                              : "—"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Kwota</p>
                          <p className="font-semibold tabular-nums">
                            {block.amount != null ? formatPln(block.amount) : "—"}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {WORK_TYPE_LABELS[block.workType]}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Podsumowanie dzienne">
                {summary.byDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak danych w tym zakresie.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.byDay.map((day) => (
                      <div
                        key={day.date}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5 text-sm"
                      >
                        <span>
                          {new Date(day.date + "T12:00:00").toLocaleDateString("pl-PL", {
                            weekday: "short",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatDuration(day.minutes)} · {day.entries}{" "}
                          {day.entries === 1 ? "wpis" : "wpisy"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Podsumowanie miesięczne">
                {summary.byMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak danych.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.byMonth.map((m) => (
                      <div
                        key={m.month}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5 text-sm"
                      >
                        <span>
                          {new Date(m.month + "-01T12:00:00").toLocaleDateString("pl-PL", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatDuration(m.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditEntry();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj wpis</DialogTitle>
            <DialogDescription>
              Zmień projekt, typ pracy, daty lub komentarz.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <CustomSelect
              options={projects.map((p) => ({
                value: p.id,
                label: p.name,
                icon: p.icon,
              }))}
              value={editProjectId}
              onChange={setEditProjectId}
              label="Projekt"
              placeholder="Wybierz projekt…"
            />
            <WorkTypeSelector value={editWorkType} onChange={setEditWorkType} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField
                label="Start"
                value={editStart}
                onChange={setEditStart}
              />
              {editingEntry && activeEntry?.id === editingEntry.id ? (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Koniec
                  </span>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    Timer w trakcie — zatrzymaj pracę, aby ustawić godzinę
                    zakończenia.
                  </div>
                </div>
              ) : (
                <DateTimeField
                  label="Koniec"
                  value={editEnd}
                  onChange={setEditEnd}
                />
              )}
            </div>
            <Textarea
              placeholder="Co zrobiłeś?"
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              rows={3}
            />
            <DialogFooter className="border-t-0 bg-transparent p-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditEntry}
                disabled={actionLoading}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-brand hover:bg-brand/90 text-white"
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Zapisz zmiany"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        highlight
          ? "border-brand/30 bg-brand/5"
          : "border-border bg-card"
      )}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", highlight && "text-brand")}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
