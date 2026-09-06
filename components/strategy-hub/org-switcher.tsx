"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface OrgOption {
  id: string;
  name: string;
  role: "owner" | "member";
  projectCount: number;
}

interface OrgListResponse {
  activeOrganizationId: string | null;
  organizations: OrgOption[];
}

interface OrgSwitcherProps {
  /**
   * Wołane zaraz po udanej zmianie organizacji (przełączenie lub utworzenie +
   * przełączenie). Sidebar używa tego, żeby odświeżyć listę projektów pod
   * selektorem — bez tego pokazywałaby projekty poprzedniej organizacji do
   * czasu ręcznego odświeżenia strony.
   */
  onOrganizationChange?: (organizationId: string) => void;
}

/**
 * Selektor organizacji w nagłówku sidebara — wejście do całej hierarchii
 * (organizacja → projekt). Wybór zapisujemy w ciasteczku po stronie serwera
 * (httpOnly), więc przetrwa odświeżenie; z tego samego powodu bieżącą
 * organizację musi podać serwer, a nie odczyt po stronie klienta.
 */
export function OrgSwitcher({ onOrganizationChange }: OrgSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(
    null
  );

  const load = useCallback((signal?: AbortSignal) => {
    apiFetch<OrgListResponse>("/api/strategy-hub/organizations", {
      signal,
      silent: true,
    })
      .then((data) => {
        setOrganizations(data.organizations);
        setActiveOrganizationId(data.activeOrganizationId);
      })
      .catch(() => {
        if (!signal?.aborted) setOrganizations([]);
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const active =
    organizations.find((o) => o.id === activeOrganizationId) ?? organizations[0];

  function select(organizationId: string) {
    if (organizationId === active?.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await apiFetch("/api/strategy-hub/organizations/select", {
          method: "POST",
          json: { organizationId },
        });
        setActiveOrganizationId(organizationId);
        onOrganizationChange?.(organizationId);
        setOpen(false);
        router.push("/strategy-hub");
        router.refresh();
      } catch {
        // apiFetch pokazał już toast — zostawiamy panel otwarty do ponowienia.
      }
    });
  }

  function create() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const res = await apiFetch<{ organization: { id: string } }>(
          "/api/strategy-hub/organizations",
          { method: "POST", json: { name } }
        );
        setNewName("");
        setCreating(false);
        load();
        select(res.organization.id);
      } catch {
        // jw. — błąd pokazany przez apiFetch
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-2 text-left transition-colors hover:border-brand/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Building2 className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-xs font-medium leading-tight">
              {active?.name ?? "Brak organizacji"}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {active
                ? `${active.projectCount} ${projektySuffix(active.projectCount)}`
                : "utwórz pierwszą"}
            </span>
          </span>
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground group-data-[collapsible=icon]:hidden" />
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Szukaj organizacji…" className="h-9" />
          <CommandList>
            <CommandEmpty>Brak organizacji o tej nazwie.</CommandEmpty>
            <CommandGroup heading="Organizacje">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => select(org.id)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      org.id === active?.id ? "opacity-100 text-brand" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{org.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {org.projectCount}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup>
              <CommandItem
                value="__wszystkie"
                onSelect={() => {
                  setOpen(false);
                  router.push("/strategy-hub/organizations");
                }}
                className="gap-2"
              >
                <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" />
                Wszystkie organizacje
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="border-t border-border p-2">
          {creating ? (
            <div className="flex items-center gap-1.5">
              <Input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- pole pojawia się dopiero po kliknięciu „Nowa organizacja"; bez fokusu użytkownik musiałby trafić w nie ponownie myszą.
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Nazwa organizacji"
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                className="h-7 bg-brand px-2 text-white hover:bg-brand/90"
                disabled={pending || !newName.trim()}
                onClick={create}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full justify-start gap-1.5 text-xs"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-3.5" />
              Nowa organizacja
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function projektySuffix(n: number): string {
  if (n === 1) return "projekt";
  const ostatnia = n % 10;
  const przedostatnia = Math.floor(n / 10) % 10;
  if (przedostatnia !== 1 && ostatnia >= 2 && ostatnia <= 4) return "projekty";
  return "projektów";
}
