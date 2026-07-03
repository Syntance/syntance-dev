"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { JsonListEditor } from "@/components/strategy-hub/json-list-editor";

interface Discount {
  threshold?: string;
  discount?: string;
  condition?: string;
  [key: string]: unknown;
}

interface B2bPricing {
  tradeTermsMd: string;
  discounts: Discount[];
  reservation: boolean;
  invoiceMd: string;
  notesMd: string;
}

const EMPTY: B2bPricing = {
  tradeTermsMd: "",
  discounts: [],
  reservation: false,
  invoiceMd: "",
  notesMd: "",
};

/**
 * Parsuje `segmentPricingMd`. Jeśli to JSON w naszym formacie — używa pól;
 * jeśli legacy plain-text — wrzuca całość do `notesMd` (bez utraty danych).
 */
function parse(value: string | null): B2bPricing {
  if (!value || !value.trim()) return { ...EMPTY };
  try {
    const obj = JSON.parse(value) as Partial<B2bPricing>;
    if (obj && typeof obj === "object" && "discounts" in obj) {
      return {
        tradeTermsMd: obj.tradeTermsMd ?? "",
        discounts: Array.isArray(obj.discounts) ? obj.discounts : [],
        reservation: Boolean(obj.reservation),
        invoiceMd: obj.invoiceMd ?? "",
        notesMd: obj.notesMd ?? "",
      };
    }
  } catch {
    // legacy plain text
  }
  return { ...EMPTY, notesMd: value };
}

/** Ustrukturyzowany cennik B2B segmentu — serializowany do segmentPricingMd. */
export function SegmentB2bPricing({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (serialized: string) => void;
}) {
  const [data, setData] = React.useState<B2bPricing>(() => parse(value));
  const lastExternal = React.useRef(value);

  // Synchronizacja przy zmianie segmentu (nowa wartość z zewnątrz).
  React.useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setData(parse(value));
    }
  }, [value]);

  const commit = React.useCallback(
    (next: B2bPricing) => {
      setData(next);
      const serialized = JSON.stringify(next);
      lastExternal.current = serialized;
      onCommit(serialized);
    },
    [onCommit]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="b2b-trade-terms" className="text-sm font-medium">Warunki trade</label>
        <Textarea
          id="b2b-trade-terms"
          value={data.tradeTermsMd}
          onChange={(e) => setData((d) => ({ ...d, tradeTermsMd: e.target.value }))}
          onBlur={() => commit(data)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Minima zamówień, terminy płatności, warunki współpracy…"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Tabela rabatów</span>
        <JsonListEditor
          value={data.discounts as Record<string, unknown>[]}
          columns={[
            { key: "threshold", label: "Próg", placeholder: "np. > 10 000 PLN" },
            { key: "discount", label: "Rabat", placeholder: "np. 12%" },
            { key: "condition", label: "Warunek", placeholder: "np. płatność z góry" },
          ]}
          onChange={(next) => commit({ ...data, discounts: next as Discount[] })}
          addLabel="Dodaj próg rabatowy"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.reservation}
          onChange={(e) => commit({ ...data, reservation: e.target.checked })}
          className="size-4 rounded border-border"
        />
        Możliwość rezerwacji towaru
      </label>

      <div className="space-y-1.5">
        <label htmlFor="b2b-invoice" className="text-sm font-medium">Faktura / rozliczenia</label>
        <Textarea
          id="b2b-invoice"
          value={data.invoiceMd}
          onChange={(e) => setData((d) => ({ ...d, invoiceMd: e.target.value }))}
          onBlur={() => commit(data)}
          rows={2}
          className="resize-none text-sm"
          placeholder="FV VAT, odroczone płatności, limit kupiecki…"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="b2b-notes" className="text-sm font-medium">Notatki cenowe</label>
        <Textarea
          id="b2b-notes"
          value={data.notesMd}
          onChange={(e) => setData((d) => ({ ...d, notesMd: e.target.value }))}
          onBlur={() => commit(data)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Dodatkowe ustalenia cenowe dla tego segmentu…"
        />
      </div>
    </div>
  );
}
