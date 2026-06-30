"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutList, Menu, ShieldCheck, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import {
  EntityCrud,
  type FieldDef,
} from "@/components/strategy-hub/entity-crud";

interface PageRef {
  id: string;
  name: string;
  urlPath?: string | null;
}

interface Props {
  projectId: string;
  siteId: string;
  pages: PageRef[];
  initialTab?: TabKey;
  visibleTabs?: TabKey[];
}

type TabKey = "sections" | "nav" | "audits" | "costs";

const TABS: { key: TabKey; label: string; icon: typeof LayoutList }[] = [
  { key: "sections", label: "Sekcje stron", icon: LayoutList },
  { key: "nav", label: "Nawigacja", icon: Menu },
  { key: "audits", label: "Audyty", icon: ShieldCheck },
  { key: "costs", label: "Koszty utrzymania", icon: Receipt },
];

const STATUS_OPTIONS: FieldDef["options"] = [
  { value: "open", label: "Otwarty", tone: "warning" },
  { value: "in_progress", label: "W toku", tone: "info" },
  { value: "resolved", label: "Rozwiązany", tone: "success" },
];

const SEVERITY_OPTIONS: FieldDef["options"] = [
  { value: "low", label: "Niska", tone: "neutral" },
  { value: "medium", label: "Średnia", tone: "warning" },
  { value: "high", label: "Wysoka", tone: "danger" },
];

const sectionFields: FieldDef[] = [
  { key: "name", label: "Nazwa sekcji", type: "text", primary: true },
  { key: "purposeMd", label: "Cel sekcji", type: "textarea" },
  { key: "copyMd", label: "Copy", type: "textarea" },
  { key: "schemaMd", label: "Struktura / schema", type: "textarea" },
  { key: "ctaText", label: "CTA", type: "text" },
  { key: "ctaUrl", label: "CTA URL", type: "url" },
  { key: "designNotesMd", label: "Notatki designu", type: "textarea" },
  { key: "orderIdx", label: "Kolejność", type: "number" },
];

const navFields: FieldDef[] = [
  { key: "label", label: "Etykieta", type: "text", primary: true },
  { key: "url", label: "URL", type: "text", placeholder: "/ lub https://…" },
  {
    key: "position",
    label: "Pozycja",
    type: "select",
    badge: true,
    options: [
      { value: "header", label: "Header", tone: "info" },
      { value: "footer", label: "Footer", tone: "neutral" },
      { value: "sidebar", label: "Sidebar", tone: "neutral" },
      { value: "mobile", label: "Mobile", tone: "warning" },
    ],
  },
  { key: "type", label: "Typ", type: "text", placeholder: "np. link, dropdown, cta" },
  { key: "orderIdx", label: "Kolejność", type: "number" },
];

const auditFields: FieldDef[] = [
  { key: "type", label: "Typ audytu", type: "text", primary: true, placeholder: "np. SEO, a11y, perf" },
  { key: "date", label: "Data", type: "date" },
  { key: "status", label: "Status", type: "select", badge: true, options: STATUS_OPTIONS },
  { key: "severityHigh", label: "Krytyczne", type: "number" },
  { key: "severityMedium", label: "Średnie", type: "number" },
  { key: "severityLow", label: "Niskie", type: "number" },
  { key: "summaryMd", label: "Podsumowanie", type: "textarea" },
];

const findingFields: FieldDef[] = [
  { key: "findingMd", label: "Ustalenie", type: "textarea", primary: true },
  { key: "area", label: "Obszar", type: "text", placeholder: "np. LCP, kontrast" },
  { key: "severity", label: "Waga", type: "select", badge: true, options: SEVERITY_OPTIONS },
  { key: "recommendationMd", label: "Rekomendacja", type: "textarea" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

interface AuditRef {
  id: string;
  type?: string | null;
  date?: string | null;
  status?: string | null;
}

function Chips<T extends { id: string }>({
  items,
  selected,
  onSelect,
  renderLabel,
}: {
  items: T[];
  selected: string | null;
  onSelect: (id: string) => void;
  renderLabel: (item: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onSelect(it.id)}
          aria-current={selected === it.id ? "true" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            selected === it.id
              ? "border-brand bg-brand/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          {renderLabel(it)}
        </button>
      ))}
    </div>
  );
}

export function WebsiteRelations({
  projectId,
  siteId,
  pages,
  initialTab = "sections",
  visibleTabs,
}: Props) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [selectedPage, setSelectedPage] = useState<string | null>(
    pages[0]?.id ?? null
  );
  const [audits, setAudits] = useState<AuditRef[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);

  const loadAudits = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/site-audits?siteId=${encodeURIComponent(siteId)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const json = await res.json();
      const items: AuditRef[] = json.items ?? [];
      setAudits(items);
      setSelectedAudit((prev) => prev ?? items[0]?.id ?? null);
    } catch {
      /* ignore */
    }
  }, [projectId, siteId]);

  useEffect(() => {
    if (tab !== "audits") return;
    const ctrl = new AbortController();
    fetch(
      `/api/strategy-hub/projects/${projectId}/site-audits?siteId=${encodeURIComponent(siteId)}`,
      { signal: ctrl.signal }
    )
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json) => {
        const items: AuditRef[] = json.items ?? [];
        setAudits(items);
        setSelectedAudit((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [tab, projectId, siteId]);

  return (
    <div className="space-y-5">
      {!(visibleTabs && visibleTabs.length === 1) && (
      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-px"
        aria-label="Sekcje strony"
      >
        {(visibleTabs
          ? TABS.filter((t) => visibleTabs.includes(t.key))
          : TABS
        ).map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors -mb-px border-b-2",
                isActive
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </nav>
      )}

      {tab === "sections" && (
        <SectionCard
          title="Sekcje stron"
          description="Mapa sekcji wybranej podstrony — cel, copy, CTA."
        >
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Najpierw dodaj podstrony powyżej, aby zaplanować ich sekcje.
            </p>
          ) : (
            <div className="space-y-4">
              <Chips
                items={pages}
                selected={selectedPage}
                onSelect={setSelectedPage}
                renderLabel={(p) => p.name}
              />
              {selectedPage && (
                <EntityCrud
                  key={selectedPage}
                  projectId={projectId}
                  entity="sections"
                  basePath={`/api/strategy-hub/projects/${projectId}/pages/${selectedPage}/sections`}
                  fields={sectionFields}
                  addLabel="Dodaj sekcję"
                  emptyHint="Brak sekcji na tej stronie."
                  dense
                />
              )}
            </div>
          )}
        </SectionCard>
      )}

      {tab === "nav" && (
        <SectionCard
          title="Nawigacja"
          description="Pozycje menu (header / footer / mobile)."
        >
          <EntityCrud
            projectId={projectId}
            entity="nav-items"
            siteId={siteId}
            fields={navFields}
            addLabel="Dodaj pozycję"
            emptyHint="Brak pozycji nawigacji."
          />
        </SectionCard>
      )}

      {tab === "audits" && (
        <div className="space-y-5">
          <SectionCard
            title="Audyty"
            description="Audyty SEO / dostępności / wydajności z liczbą znalezisk."
          >
            <EntityCrud
              projectId={projectId}
              entity="site-audits"
              siteId={siteId}
              fields={auditFields}
              addLabel="Nowy audyt"
              emptyHint="Brak audytów."
              defaults={{ status: "open", siteId }}
              onMutate={loadAudits}
            />
          </SectionCard>

          <SectionCard
            title="Ustalenia audytu"
            description="Szczegółowe znaleziska wybranego audytu."
          >
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Dodaj audyt powyżej, aby zapisać jego ustalenia.
              </p>
            ) : (
              <div className="space-y-4">
                <Chips
                  items={audits}
                  selected={selectedAudit}
                  onSelect={setSelectedAudit}
                  renderLabel={(a) =>
                    `${a.type ?? "Audyt"}${
                      a.date ? ` · ${String(a.date).slice(0, 10)}` : ""
                    }`
                  }
                />
                {selectedAudit && (
                  <EntityCrud
                    key={selectedAudit}
                    projectId={projectId}
                    entity="findings"
                    basePath={`/api/strategy-hub/projects/${projectId}/audits/${selectedAudit}/findings`}
                    fields={findingFields}
                    addLabel="Dodaj ustalenie"
                    emptyHint="Brak ustaleń w tym audycie."
                    defaults={{ severity: "medium", status: "open" }}
                    dense
                  />
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "costs" && (
        <SectionCard
          title="Koszty utrzymania"
          description="Stałe koszty utrzymania strony (hosting, domeny, narzędzia)."
        >
          <EntityCrud
            projectId={projectId}
            entity="site-maintenance-costs"
            fields={[
              { key: "item", label: "Pozycja", type: "text", primary: true },
              { key: "provider", label: "Dostawca", type: "text" },
              { key: "monthlyCost", label: "Koszt / mc (zł)", type: "number" },
              { key: "yearlyCost", label: "Koszt / rok (zł)", type: "number" },
              { key: "notesMd", label: "Notatki", type: "textarea" },
            ]}
            addLabel="Dodaj koszt"
            emptyHint="Brak kosztów utrzymania."
          />
        </SectionCard>
      )}
    </div>
  );
}
