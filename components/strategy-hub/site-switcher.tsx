"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { OptionCombobox, type ComboOption } from "@/components/strategy-hub/option-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SiteOption {
  id: string;
  name: string;
  domain: string | null;
  isPrimary: boolean;
}

interface SiteSwitcherProps {
  projectId: string;
  sites: SiteOption[];
  activeSiteId: string;
}

export function SiteSwitcher({ projectId, sites, activeSiteId }: SiteSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const options: ComboOption[] = sites.map((s) => ({
    value: s.id,
    label: s.name,
    hint: s.isPrimary ? "primary" : s.domain ?? undefined,
  }));

  const navigateToSite = useCallback(
    (siteId: string | null) => {
      if (!siteId) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("site", siteId);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const handleAddSite = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/strategy-hub/projects/${projectId}/sites`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              domain: newDomain.trim() || null,
              type: "landing",
              status: "active",
              isPrimary: false,
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!res.ok) return;
        const json: { item?: { id?: string } } = await res.json();
        const id = json.item?.id;
        setNewName("");
        setNewDomain("");
        setAdding(false);
        if (id) navigateToSite(id);
        else router.refresh();
      } catch {
        /* ignore */
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1 min-w-0 flex-1 max-w-md">
        <span className="text-xs font-medium text-muted-foreground">
          Strona WWW
        </span>
        <OptionCombobox
          options={options}
          value={activeSiteId}
          onChange={(v) => v && navigateToSite(v)}
          placeholder="Wybierz stronę…"
          clearable={false}
          className={pending ? "opacity-70" : undefined}
        />
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        {!adding ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden />
            Dodaj stronę
          </Button>
        ) : (
          <div
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 w-full sm:w-72"
            role="form"
            aria-label="Nowa strona WWW"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nazwa (np. Landing PL)"
              aria-label="Nazwa strony"
              autoFocus
            />
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="Domena (opcjonalnie)"
              aria-label="Domena"
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewDomain("");
                }}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!newName.trim() || pending}
                onClick={handleAddSite}
                className="gap-1.5"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                Utwórz
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
