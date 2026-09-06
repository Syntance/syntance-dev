"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, GitBranch, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Slug z nazwy: małe litery, bez znaków diakrytycznych, myślniki. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RODZAJE = [
  {
    value: "firma",
    label: "Cała firma",
    opis: "Klient jako całość",
    ikona: Building2,
  },
  {
    value: "galaz",
    label: "Gałąź",
    opis: "Dywizja, podfirma",
    ikona: GitBranch,
  },
  {
    value: "produkt",
    label: "Produkt / usługa",
    opis: "Pojedyncza oferta",
    ikona: Package,
  },
] as const;

export interface ParentOption {
  id: string;
  name: string;
  kind: string;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  organizationName: string;
  parentOptions: ParentOption[];
}

export function NewProjectForm({
  action,
  organizationName,
  parentOptions,
}: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  /** Czy użytkownik ręcznie nadpisał slug — wtedy przestajemy go generować. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<string>("firma");
  const [parentId, setParentId] = useState("");

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const maRodzica = parentId !== "";

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="space-y-1.5">
          <Label htmlFor="icon" className="text-xs">
            Ikona
          </Label>
          <Input
            id="icon"
            name="icon"
            placeholder="🏢"
            defaultValue="🏢"
            className="w-16 text-center text-lg"
            maxLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs">
            Nazwa projektu <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="RetroHouse"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- pierwsze pole formularza nowego projektu.
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug" className="text-xs">
          Slug <span className="text-destructive">*</span>
        </Label>
        <Input
          id="slug"
          name="slug"
          placeholder="retrohouse"
          required
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Generowany z nazwy — możesz nadpisać. Identyfikator w URL: małe litery
          i myślniki.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Czym jest ten projekt?</legend>
        <p className="text-xs text-muted-foreground">
          Powstanie w organizacji <strong>{organizationName}</strong>. Wybór
          wpływa na drzewo i podsumowanie — nie ogranicza dostępnych modułów.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {RODZAJE.map((r) => {
            const Ikona = r.ikona;
            const wybrany = kind === r.value;
            return (
              <label
                key={r.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                  wybrany
                    ? "border-brand bg-brand/5"
                    : "border-border hover:border-brand/40"
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={r.value}
                  checked={wybrany}
                  onChange={() => setKind(r.value)}
                  className="sr-only"
                />
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Ikona className="size-3.5" />
                  {r.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {r.opis}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {parentOptions.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="parentProjectId" className="text-xs">
              Projekt nadrzędny
            </Label>
            <select
              id="parentProjectId"
              name="parentProjectId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— brak (projekt najwyższego poziomu) —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/*
            Opis jest RODZEŃSTWEM etykiety, nie jej częścią: wpięty w <label>
            byłby czytany przez czytnik ekranu jako nazwa pola wyboru. Wiąże go
            z polem `aria-describedby`.
          */}
          <div className={cn("space-y-1", !maRodzica && "opacity-50")}>
            <label
              htmlFor="dziedziczyFundament"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <input
                id="dziedziczyFundament"
                type="checkbox"
                name="dziedziczyFundament"
                value="1"
                disabled={!maRodzica}
                aria-describedby="dziedziczyFundament-opis"
                className="size-3.5"
              />
              Dziedzicz fundament
            </label>
            <p
              id="dziedziczyFundament-opis"
              className="ml-[1.375rem] text-[11px] text-muted-foreground"
            >
              Problemy biznesowe, UVP, pozycjonowanie, konkurenci, marka
              i oferty będą czytane z projektu nadrzędnego. Rynek, lejek,
              strony i KPI zostają własne. Możesz to później odłączyć.
            </p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="clientName" className="text-xs">
            Nazwa klienta
          </Label>
          <Input id="clientName" name="clientName" placeholder="Jan Kowalski" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="domain" className="text-xs">
            Domena
          </Label>
          <Input id="domain" name="domain" placeholder="retrohouse.pl" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">
          Opis projektu
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Krótki opis — co to za projekt, dla kogo, jaki cel."
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/strategy-hub">Anuluj</Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-brand hover:bg-brand/90 text-white"
        >
          Utwórz projekt
        </Button>
      </div>
    </form>
  );
}
