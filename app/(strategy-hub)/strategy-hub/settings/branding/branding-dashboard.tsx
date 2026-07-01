"use client";

import { useState } from "react";
import { CheckCircle2, Save, Image as ImageIcon, Palette, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceBranding } from "@/lib/client-portal/branding";

interface Props {
  initial: WorkspaceBranding & { status: string };
}

function colorFor(colors: WorkspaceBranding["colors"], role: string, fallback: string) {
  return colors.find((c) => c.role === role)?.value ?? fallback;
}

export function BrandingDashboard({ initial }: Props) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [brand, setBrand] = useState(colorFor(initial.colors, "brand", "#6d28d9"));
  const [brandLight, setBrandLight] = useState(
    colorFor(initial.colors, "brand-light", "#8b5cf6")
  );
  const [customDomain, setCustomDomain] = useState(initial.customDomain ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const res = await fetch("/api/strategy-hub/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: logoUrl.trim() || null,
          colors: [
            { name: "Marka", value: brand, role: "brand" },
            { name: "Marka (jasny)", value: brandLight, role: "brand-light" },
          ],
          customDomain: customDomain.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nie udało się zapisać ustawień");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <ImageIcon className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Logo</h2>
            <p className="text-xs text-muted-foreground">
              URL do pliku logo (SVG/PNG) — zastąpi logo Syntance w portalu klienta
            </p>
          </div>
        </div>
        <Input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://cdn.twojadomena.pl/logo.svg"
          aria-label="URL logo"
        />
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL zewnętrzny, niekontrolowana domena
          <img
            src={logoUrl}
            alt="Podgląd logo"
            className="h-10 w-auto max-w-[200px] object-contain rounded bg-white/5 p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Palette className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Kolory marki</h2>
            <p className="text-xs text-muted-foreground">
              Nadpisują akcent koloru we wszystkich widokach portalu klienta
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="color"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="size-8 rounded border border-border/60 cursor-pointer bg-transparent"
              aria-label="Kolor główny marki"
            />
            Główny ({brand})
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="color"
              value={brandLight}
              onChange={(e) => setBrandLight(e.target.value)}
              className="size-8 rounded border border-border/60 cursor-pointer bg-transparent"
              aria-label="Kolor jasny marki"
            />
            Jasny ({brandLight})
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Globe className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Domena własna</h2>
            <p className="text-xs text-muted-foreground">
              Do informacji — pełne mapowanie DNS/routingu wymaga konfiguracji poza aplikacją
            </p>
          </div>
        </div>
        <Input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="portal.twojaagencja.pl"
          aria-label="Domena własna"
        />
      </section>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="gap-1.5"
      >
        {saving ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <Save className="size-3.5" />
        )}
        {saved ? "Zapisano" : "Zapisz branding"}
      </Button>
    </div>
  );
}
