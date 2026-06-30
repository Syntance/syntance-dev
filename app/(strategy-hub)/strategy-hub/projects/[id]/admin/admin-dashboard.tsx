"use client";

import { Server, Globe, Link2 } from "lucide-react";
import { ResourceList } from "@/components/strategy-hub/resource-list";
import {
  upsertHosting,
  deleteHosting,
  upsertDomain,
  deleteDomain,
  upsertResource,
  deleteResource,
} from "@/lib/strategy-hub/actions";

interface Hosting {
  id: string;
  projectId: string;
  name: string;
  type: string | null;
  provider: string | null;
  url: string | null;
  status: string | null;
  monthlyCost: number | null;
  notes: string | null;
}
interface Domain {
  id: string;
  projectId: string;
  name: string;
  registrar: string | null;
  expiresAt: Date | null;
  sslStatus: string | null;
  dnsProvider: string | null;
}
interface Resource {
  id: string;
  projectId: string;
  label: string;
  url: string;
  category: string | null;
  icon: string | null;
  orderIdx: number | null;
}

interface Props {
  projectId: string;
  projectName: string;
  hosting: Hosting[];
  domains: Domain[];
  resources: Resource[];
}

export function AdminDashboard({
  projectId,
  projectName,
  hosting,
  domains,
  resources,
}: Props) {
  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          🛠️ Infrastruktura projektu
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {projectName} · Te dane widzi klient w swoim dashboardzie
        </p>
      </div>

      <ResourceList
        title="Domeny"
        icon={<Globe className="size-4 text-brand" />}
        items={domains}
        emptyHint="Dodaj domeny projektu (główna, staging, alias…)."
        newButtonLabel="Nowa domena"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "name", label: "Domena", required: true, placeholder: "example.com" },
          { name: "registrar", label: "Rejestrator", placeholder: "Cloudflare / OVH" },
          { name: "dnsProvider", label: "DNS provider" },
          { name: "expiresAt", label: "Wygasa", type: "date" },
          {
            name: "sslStatus",
            label: "SSL",
            type: "select",
            options: [
              { value: "active", label: "Aktywny" },
              { value: "pending", label: "Pending" },
              { value: "expired", label: "Wygasły" },
              { value: "none", label: "Brak" },
            ],
          },
        ]}
        renderRow={(d) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm">{d.name}</div>
              {d.registrar && (
                <div className="text-xs text-muted-foreground">{d.registrar}</div>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {d.sslStatus ?? "ssl?"}
            </span>
          </div>
        )}
        onSave={async (data) => {
          await upsertDomain({
            ...data,
            projectId: data.projectId as string,
            name: data.name as string,
            expiresAt: (data.expiresAt as string) || null,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deleteDomain(id, projectId)}
      />

      <ResourceList
        title="Serwisy hostingowe"
        icon={<Server className="size-4 text-brand" />}
        items={hosting}
        emptyHint="Vercel, Supabase, Cloudflare, Resend… z kosztami."
        newButtonLabel="Nowy serwis"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "name", label: "Nazwa", required: true, placeholder: "Vercel" },
          { name: "type", label: "Typ", placeholder: "hosting / db / email" },
          { name: "provider", label: "Provider", placeholder: "Vercel Inc." },
          { name: "url", label: "URL panelu", full: true },
          { name: "monthlyCost", label: "Koszt mies. (PLN)", type: "number" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "trial", label: "Trial" },
              { value: "expired", label: "Expired" },
            ],
          },
          { name: "notes", label: "Notatki", type: "textarea" },
        ]}
        renderRow={(h) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{h.name}</div>
              <div className="text-xs text-muted-foreground">
                {h.provider}
                {h.type && <span> · {h.type}</span>}
              </div>
            </div>
            {h.monthlyCost != null && (
              <div className="text-xs font-mono text-muted-foreground shrink-0">
                {h.monthlyCost} PLN
              </div>
            )}
          </div>
        )}
        onSave={async (data) => {
          await upsertHosting({
            ...data,
            projectId: data.projectId as string,
            name: data.name as string,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deleteHosting(id, projectId)}
      />

      <ResourceList
        title="Linki dla klienta"
        icon={<Link2 className="size-4 text-brand" />}
        items={resources}
        emptyHint="Panel hostingu, GA, GSC, Figma… — to zobaczy klient."
        newButtonLabel="Nowy link"
        fields={[
          { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
          { name: "label", label: "Etykieta", required: true, placeholder: "np. Google Analytics" },
          { name: "url", label: "URL", required: true, full: true },
          { name: "category", label: "Kategoria", placeholder: "analytics / design / hosting" },
          { name: "icon", label: "Emoji ikona", placeholder: "📊" },
          { name: "orderIdx", label: "Kolejność", type: "number" },
        ]}
        renderRow={(r) => (
          <div className="flex items-center gap-3 min-w-0">
            <span className="size-7 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
              {r.icon ?? "🔗"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{r.label}</div>
              <div className="text-xs text-muted-foreground truncate">{r.url}</div>
            </div>
            {r.category && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {r.category}
              </span>
            )}
          </div>
        )}
        onSave={async (data) => {
          await upsertResource({
            ...data,
            projectId: data.projectId as string,
            label: data.label as string,
            url: data.url as string,
            id: data.id as string | undefined,
          });
        }}
        onDelete={(id) => deleteResource(id, projectId)}
      />
    </div>
  );
}
