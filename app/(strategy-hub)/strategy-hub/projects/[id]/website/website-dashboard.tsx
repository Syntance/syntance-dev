"use client";

import { FileBox, Search, Layers } from "lucide-react";
import { ResourceList } from "@/components/strategy-hub/resource-list";
import {
  upsertPage,
  deletePage,
  upsertSeoKeyword,
  deleteSeoKeyword,
  upsertTechStack,
  deleteTechStack,
} from "@/lib/strategy-hub/actions";

interface Page {
  id: string;
  projectId: string;
  name: string;
  urlPath: string | null;
  type: string | null;
  roleInFunnel: string | null;
  cta: string | null;
  goal: string | null;
  status: string | null;
  priority: number | null;
}
interface SeoKeyword {
  id: string;
  projectId: string;
  phrase: string;
  intent: string | null;
  volume: number | null;
  difficulty: number | null;
  priority: number | null;
  funnelStage: string | null;
  status: string | null;
}
interface TechItem {
  id: string;
  projectId: string;
  name: string;
  category: string | null;
  monthlyCost: number | null;
  yearlyCost: number | null;
  description: string | null;
  url: string | null;
  status: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  pages: Page[];
  seoKeywords: SeoKeyword[];
  techStack: TechItem[];
}

export function WebsiteDashboard({
  projectId,
  projectName,
  pages,
  seoKeywords,
  techStack,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">🌐 Strona</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {projectName} · {pages.length} podstron · {seoKeywords.length} fraz SEO ·{" "}
          {techStack.length} pozycji stacku
        </p>
      </div>

      <ResourceList
        title="Podstrony"
        icon={<FileBox className="size-4 text-brand" />}
        items={pages}
        emptyHint="Zmapuj strukturę strony — każda podstrona z rolą w lejku."
        newButtonLabel="Nowa podstrona"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "name", label: "Nazwa", required: true, placeholder: "np. Home" },
          { name: "urlPath", label: "Ścieżka URL", placeholder: "/" },
          {
            name: "type",
            label: "Typ",
            type: "select",
            options: [
              { value: "landing", label: "Landing" },
              { value: "product", label: "Product" },
              { value: "blog", label: "Blog" },
              { value: "case-study", label: "Case study" },
              { value: "pricing", label: "Pricing" },
              { value: "contact", label: "Contact" },
              { value: "legal", label: "Legal" },
            ],
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "design", label: "Design" },
              { value: "dev", label: "Development" },
              { value: "live", label: "Live" },
            ],
          },
          { name: "cta", label: "Główne CTA", placeholder: "np. Umów rozmowę" },
          { name: "priority", label: "Priorytet", type: "number", placeholder: "0" },
          { name: "roleInFunnel", label: "Rola w lejku", type: "textarea" },
          { name: "goal", label: "Cel strony", type: "textarea" },
        ]}
        renderRow={(p) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{p.name}</span>
                {p.urlPath && (
                  <code className="text-[10px] text-muted-foreground font-mono">
                    {p.urlPath}
                  </code>
                )}
              </div>
              {p.cta && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  CTA: {p.cta}
                </div>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {p.status ?? "draft"}
            </span>
          </div>
        )}
        onSave={async (data) => {
          await upsertPage({
            ...data,
            projectId: data.projectId as string,
            name: data.name as string,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deletePage(id, projectId)}
      />

      <ResourceList
        title="SEO — frazy kluczowe"
        icon={<Search className="size-4 text-brand" />}
        items={seoKeywords}
        emptyHint="Dodaj frazy do pozycjonowania — intent, volume, difficulty."
        newButtonLabel="Nowa fraza"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "phrase", label: "Fraza", required: true, full: true, placeholder: "np. studio webowe wrocław" },
          {
            name: "intent",
            label: "Intent",
            type: "select",
            options: [
              { value: "informational", label: "Informational" },
              { value: "navigational", label: "Navigational" },
              { value: "transactional", label: "Transactional" },
              { value: "commercial", label: "Commercial" },
            ],
          },
          {
            name: "funnelStage",
            label: "Etap lejka",
            type: "select",
            options: [
              { value: "TOFU", label: "TOFU" },
              { value: "MOFU", label: "MOFU" },
              { value: "BOFU", label: "BOFU" },
            ],
          },
          { name: "volume", label: "Volume / mies.", type: "number" },
          { name: "difficulty", label: "Difficulty (0-100)", type: "number" },
          { name: "priority", label: "Priorytet", type: "number" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "research", label: "Research" },
              { value: "targeted", label: "Targeted" },
              { value: "ranking", label: "Ranking" },
              { value: "won", label: "Won (top 3)" },
            ],
          },
        ]}
        renderRow={(s) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm">{s.phrase}</div>
              <div className="text-xs text-muted-foreground">
                {s.intent && <span>{s.intent}</span>}
                {s.funnelStage && <span> · {s.funnelStage}</span>}
              </div>
            </div>
            <div className="text-right shrink-0 text-xs text-muted-foreground font-mono">
              {s.volume && <span>vol {s.volume}</span>}
              {s.difficulty != null && <span> · KD {s.difficulty}</span>}
            </div>
          </div>
        )}
        onSave={async (data) => {
          await upsertSeoKeyword({
            ...data,
            projectId: data.projectId as string,
            phrase: data.phrase as string,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deleteSeoKeyword(id, projectId)}
      />

      <ResourceList
        title="Stack technologiczny"
        icon={<Layers className="size-4 text-brand" />}
        items={techStack}
        emptyHint="Wszystkie narzędzia projektu z kosztami — dla budżetowania."
        newButtonLabel="Nowa pozycja"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "name", label: "Nazwa", required: true, placeholder: "np. Vercel" },
          { name: "category", label: "Kategoria", placeholder: "np. Hosting, CMS, Auth" },
          { name: "monthlyCost", label: "Koszt mies. (PLN)", type: "number" },
          { name: "yearlyCost", label: "Koszt rocz. (PLN)", type: "number" },
          { name: "url", label: "URL", full: true },
          { name: "description", label: "Opis", type: "textarea" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "evaluating", label: "Evaluating" },
              { value: "deprecated", label: "Deprecated" },
            ],
          },
        ]}
        renderRow={(t) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{t.name}</div>
              {t.category && (
                <div className="text-xs text-muted-foreground">{t.category}</div>
              )}
            </div>
            {t.monthlyCost != null && (
              <div className="text-xs text-muted-foreground font-mono shrink-0">
                {t.monthlyCost} PLN / mies.
              </div>
            )}
          </div>
        )}
        onSave={async (data) => {
          await upsertTechStack({
            ...data,
            projectId: data.projectId as string,
            name: data.name as string,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deleteTechStack(id, projectId)}
      />
    </div>
  );
}
