"use client";

import { useState } from "react";
import Link from "next/link";
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

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export function NewProjectForm({ action }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  /** Czy użytkownik ręcznie nadpisał slug — wtedy przestajemy go generować. */
  const [slugTouched, setSlugTouched] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

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
