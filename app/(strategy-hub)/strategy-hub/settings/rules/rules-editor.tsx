"use client";

import { useMemo, useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  RulesConfig,
  ModuleRule,
  Connection,
  Correlation,
  HealthCriterion,
} from "@/lib/strategy-hub/rules/types";
import { DEFAULT_RULES } from "@/lib/strategy-hub/rules/defaults";
import { upsertRules, resetRules } from "./actions";
import { Loader2, RotateCcw, Save } from "lucide-react";

interface Props {
  initialGlobal: RulesConfig;
  projectScopes: { scope: string; label: string; config: RulesConfig }[];
}

export function RulesEditor({ initialGlobal, projectScopes }: Props) {
  const [scope, setScope] = useState("global");
  const [draft, setDraft] = useState<RulesConfig>(initialGlobal);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const scopes = [
    { scope: "global", label: "Globalne (domyślne)", config: initialGlobal },
    ...projectScopes,
  ];

  const active = scopes.find((s) => s.scope === scope) ?? scopes[0];

  function selectScope(next: string) {
    setScope(next);
    const found = scopes.find((s) => s.scope === next);
    setDraft(found?.config ?? initialGlobal);
    setSaved(false);
  }

  function patch(partial: Partial<RulesConfig>) {
    setDraft((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await upsertRules(scope, draft);
      setSaved(true);
    });
  }

  function reset() {
    startTransition(async () => {
      await resetRules(scope);
      setDraft(scope === "global" ? DEFAULT_RULES : active.config);
      setSaved(true);
    });
  }

  const nodeKeys = useMemo(() => draft.modules.map((m) => m.key), [draft.modules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="rules-scope" className="text-xs text-muted-foreground">
          Zakres
        </Label>
        <select
          id="rules-scope"
          value={scope}
          onChange={(e) => selectScope(e.target.value)}
          className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
        >
          {scopes.map((s) => (
            <option key={s.scope} value={s.scope}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => reset()}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => save()}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Zapisz
          </Button>
        </div>
      </div>
      {saved && (
        <p className="text-xs text-success">
          Zapisano — health-score, mapa i graf wpływu użyją nowych reguł przy
          następnym wejściu.
        </p>
      )}

      <Tabs defaultValue="connections">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="connections">Zależności</TabsTrigger>
          <TabsTrigger value="correlations">Korelacje</TabsTrigger>
          <TabsTrigger value="modules">Moduły</TabsTrigger>
          <TabsTrigger value="alerts">Alerty</TabsTrigger>
          <TabsTrigger value="appearance">Wygląd</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="mt-4">
          <ConnectionsMatrix
            nodeKeys={nodeKeys}
            connections={draft.connections}
            onChange={(connections) => patch({ connections })}
          />
        </TabsContent>

        <TabsContent value="correlations" className="mt-4">
          <CorrelationsTable
            correlations={draft.correlations}
            onChange={(correlations) => patch({ correlations })}
          />
        </TabsContent>

        <TabsContent value="modules" className="mt-4 space-y-3">
          <ModulesEditor
            modules={draft.modules}
            nodeKeys={nodeKeys}
            onChange={(modules) => patch({ modules })}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsEditor
            alerts={draft.alerts}
            onChange={(alerts) => patch({ alerts })}
          />
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 space-y-5">
          <PaletteEditor
            palette={draft.palette}
            onChange={(palette) => patch({ palette })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Zależności (macierz from × to) ───────────────────────────────────────────

function ConnectionsMatrix({
  nodeKeys,
  connections,
  onChange,
}: {
  nodeKeys: string[];
  connections: Connection[];
  onChange: (next: Connection[]) => void;
}) {
  const has = (from: string, to: string) =>
    connections.some((c) => c.from === from && c.to === to);

  function toggle(from: string, to: string) {
    if (from === to) return;
    if (has(from, to)) {
      onChange(connections.filter((c) => !(c.from === from && c.to === to)));
    } else {
      onChange([...connections, { from, to }]);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Zaznacz zależności między węzłami strategii (wiersz „od” → kolumna „do”).
        Sterują układem mapy firmy i blokadą downstream (lock).
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-muted-foreground">od \ do</th>
              {nodeKeys.map((to) => (
                <th key={to} className="p-2 text-center font-medium">
                  {to}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodeKeys.map((from) => (
              <tr key={from} className="border-t border-border">
                <td className="p-2 font-medium whitespace-nowrap">{from}</td>
                {nodeKeys.map((to) => (
                  <td key={to} className="p-1 text-center">
                    {from === to ? (
                      <span className="text-muted-foreground/30">·</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={has(from, to)}
                        onChange={() => toggle(from, to)}
                        aria-label={`${from} → ${to}`}
                        className="size-4 accent-[var(--brand)]"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Korelacje (graf wpływu) ──────────────────────────────────────────────────

function CorrelationsTable({
  correlations,
  onChange,
}: {
  correlations: Correlation[];
  onChange: (next: Correlation[]) => void;
}) {
  function update(idx: number, partial: Partial<Correlation>) {
    onChange(
      correlations.map((c, i) => (i === idx ? { ...c, ...partial } : c))
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Etykiety i siła krawędzi grafu wpływu. „Wymagane” = brak takiej relacji
        oznacza element czerwoną ramką „niepodłączony”.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 text-left">źródło → cel</th>
              <th className="p-2 text-left">etykieta</th>
              <th className="p-2 text-left">siła</th>
              <th className="p-2 text-center">wymagane</th>
            </tr>
          </thead>
          <tbody>
            {correlations.map((c, idx) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-mono whitespace-nowrap text-muted-foreground">
                  {c.sourceType} → {c.targetType}
                </td>
                <td className="p-2">
                  <Input
                    value={c.label}
                    onChange={(e) => update(idx, { label: e.target.value })}
                    className="h-7 text-xs"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={c.defaultStrength}
                    onChange={(e) =>
                      update(idx, {
                        defaultStrength: e.target
                          .value as Correlation["defaultStrength"],
                      })
                    }
                    className="h-7 rounded-md border border-border bg-transparent px-2 text-xs"
                  >
                    <option value="strong">strong</option>
                    <option value="normal">normal</option>
                    <option value="weak">weak</option>
                  </select>
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) => update(idx, { required: e.target.checked })}
                    className="size-4 accent-[var(--brand)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Moduły (progi + kryteria) ────────────────────────────────────────────────

function ModulesEditor({
  modules,
  nodeKeys,
  onChange,
}: {
  modules: ModuleRule[];
  nodeKeys: string[];
  onChange: (next: ModuleRule[]) => void;
}) {
  function updateModule(idx: number, partial: Partial<ModuleRule>) {
    onChange(modules.map((m, i) => (i === idx ? { ...m, ...partial } : m)));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Progi gotowości, kryteria health-score i zależności blokujące (lock) per
        moduł.
      </p>
      {modules.map((m, idx) => (
        <details
          key={m.key}
          className="rounded-lg border border-border bg-card/40 p-3"
        >
          <summary className="cursor-pointer text-sm font-medium">
            {m.label}{" "}
            <span className="text-xs text-muted-foreground">({m.key})</span>
          </summary>
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField
                label="Próg „gotowe” (%)"
                value={m.readyThreshold}
                onChange={(v) => updateModule(idx, { readyThreshold: v })}
              />
              <NumberField
                label="Próg „w toku”"
                value={m.inProgressThreshold}
                onChange={(v) => updateModule(idx, { inProgressThreshold: v })}
              />
              <label className="flex items-center gap-2 text-xs mt-5">
                <input
                  type="checkbox"
                  checked={m.visibleInClient}
                  onChange={(e) =>
                    updateModule(idx, { visibleInClient: e.target.checked })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                Widoczny dla klienta
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={m.lock.enabled}
                  onChange={(e) =>
                    updateModule(idx, {
                      lock: { ...m.lock, enabled: e.target.checked },
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="font-medium">Blokuj dopóki upstream pusty</span>
              </div>
              {m.lock.enabled && (
                <div className="flex flex-wrap gap-2 pl-6">
                  {nodeKeys
                    .filter((k) => k !== m.key)
                    .map((k) => {
                      const on = m.lock.requiresUpstream.includes(k);
                      return (
                        <label
                          key={k}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              updateModule(idx, {
                                lock: {
                                  ...m.lock,
                                  requiresUpstream: e.target.checked
                                    ? [...m.lock.requiresUpstream, k]
                                    : m.lock.requiresUpstream.filter(
                                        (x) => x !== k
                                      ),
                                },
                              })
                            }
                            className="size-3.5 accent-[var(--brand)]"
                          />
                          {k}
                        </label>
                      );
                    })}
                </div>
              )}
            </div>

            <CriteriaEditor
              criteria={m.criteria}
              onChange={(criteria) => updateModule(idx, { criteria })}
            />
          </div>
        </details>
      ))}
    </div>
  );
}

function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: HealthCriterion[];
  onChange: (next: HealthCriterion[]) => void;
}) {
  function update(idx: number, partial: Partial<HealthCriterion>) {
    onChange(criteria.map((c, i) => (i === idx ? { ...c, ...partial } : c)));
  }

  if (criteria.length === 0)
    return <p className="text-xs text-muted-foreground">Brak kryteriów.</p>;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Kryteria health-score
      </span>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-1.5 text-left">opis</th>
              <th className="p-1.5 text-left">metryka</th>
              <th className="p-1.5 text-left">próg</th>
              <th className="p-1.5 text-left">waga</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, idx) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-1.5">
                  <Input
                    value={c.label}
                    onChange={(e) => update(idx, { label: e.target.value })}
                    className="h-7 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={c.metric}
                    onChange={(e) =>
                      update(idx, {
                        metric: e.target.value as HealthCriterion["metric"],
                      })
                    }
                    className="h-7 rounded-md border border-border bg-transparent px-1.5 text-xs"
                  >
                    <option value="count_gte">count_gte</option>
                    <option value="field_filled">field_filled</option>
                    <option value="ratio">ratio</option>
                    <option value="custom">custom</option>
                  </select>
                </td>
                <td className="p-1.5">
                  <Input
                    type="number"
                    value={c.target ?? ""}
                    onChange={(e) =>
                      update(idx, {
                        target:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="h-7 w-16 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={c.weight}
                    onChange={(e) =>
                      update(idx, { weight: Number(e.target.value) })
                    }
                    className="h-7 w-16 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Alerty ───────────────────────────────────────────────────────────────────

function AlertsEditor({
  alerts,
  onChange,
}: {
  alerts: RulesConfig["alerts"];
  onChange: (next: RulesConfig["alerts"]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        label="KPI poniżej (%)"
        value={alerts.kpiBelowPct}
        onChange={(v) => onChange({ ...alerts, kpiBelowPct: v })}
        hint="Alert, gdy KPI < tego % celu."
      />
      <NumberField
        label="Przez ile dni"
        value={alerts.kpiBelowDays}
        onChange={(v) => onChange({ ...alerts, kpiBelowDays: v })}
        hint="…utrzymuje się poniżej progu."
      />
      <NumberField
        label="Brak wizyty klienta (dni)"
        value={alerts.visitDays}
        onChange={(v) => onChange({ ...alerts, visitDays: v })}
        hint="Alert, gdy klient nie odwiedził dashboardu tyle dni."
      />
      <NumberField
        label="Domena wygasa za (dni)"
        value={alerts.domainExpiringDays}
        onChange={(v) => onChange({ ...alerts, domainExpiringDays: v })}
      />
      <NumberField
        label="Próg błędów sync"
        value={alerts.syncFailThreshold}
        onChange={(v) => onChange({ ...alerts, syncFailThreshold: v })}
      />
    </div>
  );
}

// ─── Wygląd (paleta) ──────────────────────────────────────────────────────────

function PaletteEditor({
  palette,
  onChange,
}: {
  palette: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(palette);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Kolory typów encji w grafie wpływu (limit ~8–10 — więcej = chaos).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([type, hex]) => (
          <div key={type} className="flex items-center gap-2">
            <input
              type="color"
              value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : "#888888"}
              onChange={(e) => onChange({ ...palette, [type]: e.target.value })}
              className="size-7 rounded border border-border bg-transparent"
              aria-label={`Kolor ${type}`}
            />
            <span className="text-xs font-medium w-24 truncate">{type}</span>
            <Input
              value={hex}
              onChange={(e) => onChange({ ...palette, [type]: e.target.value })}
              className="h-7 text-xs font-mono flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pole liczbowe ────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
