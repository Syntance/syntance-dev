"use client";

import { useState } from "react";
import { Building2, GitBranch, Package, Link2, Unlink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const RODZAJE = [
  { value: "firma", label: "Cała firma", opis: "Klient jako całość", ikona: Building2 },
  { value: "galaz", label: "Gałąź", opis: "Dywizja, podfirma", ikona: GitBranch },
  { value: "produkt", label: "Produkt / usługa", opis: "Pojedyncza oferta", ikona: Package },
] as const;

const POWODY_ZERWANIA: Record<string, string> = {
  "brak-rodzica": "Projekt jest ustawiony na dziedziczenie, ale nie ma rodzica.",
  cykl: "Łańcuch dziedziczenia zapętla się.",
  "za-gleboko": "Łańcuch dziedziczenia jest zbyt długi.",
};

interface ParentOption {
  id: string;
  name: string;
  kind: string;
}

interface Props {
  projectId: string;
  organizationName: string;
  kind: string;
  parentProjectId: string | null;
  strategyMode: string;
  parentOptions: ParentOption[];
  foundationSourceName: string | null;
  brokenChain: string | null;
  onSavePlacement: (formData: FormData) => Promise<void>;
  onSetInheritance: (formData: FormData) => Promise<void>;
}

/**
 * „Czym jest ten projekt" — rodzaj, miejsce w drzewie organizacji i tryb
 * fundamentu. Tryb strategii celowo NIE jest zwykłym selectem: przejście
 * z dziedziczenia na własny fundament kopiuje dane, więc musi być świadomą
 * akcją z opisem konsekwencji, a nie skutkiem ubocznym zapisu formularza.
 */
export function ProjectPlacementForm({
  projectId,
  organizationName,
  kind,
  parentProjectId,
  strategyMode,
  parentOptions,
  foundationSourceName,
  brokenChain,
  onSavePlacement,
  onSetInheritance,
}: Props) {
  const [wybranyKind, setWybranyKind] = useState(kind);
  const [wybranyRodzic, setWybranyRodzic] = useState(parentProjectId ?? "");

  const dziedziczy = strategyMode === "dziedziczona";

  return (
    <div className="space-y-6">
      <form action={onSavePlacement} className="space-y-5 rounded-xl border border-border p-5">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <h2 className="text-sm font-medium">Miejsce w organizacji</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Projekt należy do organizacji <strong>{organizationName}</strong>.
            Rodzaj i rodzic sterują drzewem oraz podsumowaniem — nie ograniczają
            dostępnych modułów.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Czym jest ten projekt?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {RODZAJE.map((r) => {
              const Ikona = r.ikona;
              const wybrany = wybranyKind === r.value;
              return (
                <label
                  key={r.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                    wybrany ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={r.value}
                    checked={wybrany}
                    onChange={() => setWybranyKind(r.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Ikona className="size-3.5" />
                    {r.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{r.opis}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="parentProjectId" className="text-xs">
            Projekt nadrzędny
          </Label>
          <select
            id="parentProjectId"
            name="parentProjectId"
            value={wybranyRodzic}
            onChange={(e) => setWybranyRodzic(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— brak (projekt najwyższego poziomu) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Lista pomija projekty podrzędne wobec tego — nie da się zapętlić drzewa.
            Usunięcie rodzica przełącza fundament na własny.
          </p>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button type="submit" size="sm" className="bg-brand text-white hover:bg-brand/90">
            Zapisz
          </Button>
        </div>
      </form>

      <div className="space-y-4 rounded-xl border border-border p-5">
        <div>
          <h2 className="text-sm font-medium">Fundament strategii</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Fundament to problemy biznesowe, UVP, pozycjonowanie, konkurenci,
            marka i oferty. Rynek, podróż zakupowa, lejek, strony i KPI są
            zawsze własne dla projektu.
          </p>
        </div>

        {brokenChain && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {POWODY_ZERWANIA[brokenChain] ?? "Łańcuch dziedziczenia jest zerwany."}{" "}
              Fundament czytany jest lokalnie.
            </span>
          </p>
        )}

        <div className="flex items-center gap-2 text-xs">
          {dziedziczy ? (
            <>
              <Link2 className="size-3.5 text-brand" />
              <span>
                Dziedziczony
                {foundationSourceName ? (
                  <>
                    {" "}
                    z projektu <strong>{foundationSourceName}</strong>
                  </>
                ) : null}
              </span>
            </>
          ) : (
            <>
              <Unlink className="size-3.5 text-muted-foreground" />
              <span>Własny fundament tego projektu</span>
            </>
          )}
        </div>

        <form action={onSetInheritance}>
          <input type="hidden" name="projectId" value={projectId} />
          {dziedziczy ? (
            <>
              <input type="hidden" name="tryb" value="wlasna" />
              <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                <Unlink className="size-3.5" />
                Odłącz i skopiuj fundament
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Skopiuje obecnie widoczny fundament do tego projektu i odetnie go
                od rodzica. Dane nie znikną — od tej chwili będziesz je edytować
                niezależnie.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="tryb" value="dziedziczona" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!parentProjectId}
              >
                <Link2 className="size-3.5" />
                Dziedzicz z projektu nadrzędnego
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {parentProjectId
                  ? "Fundament tego projektu przestanie być widoczny — zobaczysz fundament rodzica. Własne wiersze zostaną w bazie i wrócą po odłączeniu."
                  : "Najpierw wskaż projekt nadrzędny powyżej."}
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
