import { z } from "zod";

/** 1 = neutralne (zielony), 2 = średnie (żółty), 3 = ważne (czerwony) */
export type StrategyListWeight = 1 | 2 | 3;

export interface StrategyListItem {
  id: string;
  text: string;
  note: string;
  weight: StrategyListWeight;
}

export const WEIGHT_LABELS: Record<StrategyListWeight, string> = {
  1: "Neutralne",
  2: "Średnie",
  3: "Ważne",
};

export const WEIGHT_OPTIONS: {
  value: StrategyListWeight;
  label: string;
}[] = [
  { value: 3, label: "Ważne" },
  { value: 2, label: "Średnie" },
  { value: 1, label: "Neutralne" },
];

/** Mapuje legacy wagi 1–5 na nowy system 1–3. */
export function normalizeWeight(raw: number): StrategyListWeight {
  if (raw >= 4) return 3;
  if (raw === 3) return 2;
  if (raw === 2) return 2;
  return 1;
}

const itemSchema = z
  .object({
    id: z.string().optional(),
    text: z.string(),
    note: z.string().optional().default(""),
    weight: z
      .number()
      .int()
      .optional()
      .default(2)
      .transform((v) => normalizeWeight(v ?? 2)),
  })
  .transform((item) => ({
    ...item,
    id: item.id ?? crypto.randomUUID(),
  }));

const listSchema = z.array(itemSchema);

export function createStrategyListItem(text: string): StrategyListItem {
  return {
    id: crypto.randomUUID(),
    text,
    note: "",
    weight: 2,
  };
}

function parseLegacyMarkdown(content: string): StrategyListItem[] {
  const trimmed = content
    .trim()
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const lines = trimmed.split("\n").map((line) => line.trim());

  const bulletItems = lines
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);

  if (bulletItems.length > 0) {
    return bulletItems.map((text) => createStrategyListItem(text));
  }

  const numberedItems = lines
    .filter((line) => /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);

  if (numberedItems.length > 0) {
    return numberedItems.map((text) => createStrategyListItem(text));
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s+/gm, "").trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs.map((text) => createStrategyListItem(text));
  }

  const single = trimmed.replace(/^#+\s+/gm, "").trim();
  return single ? [createStrategyListItem(single)] : [];
}

function tryParseJsonList(raw: string): StrategyListItem[] | null {
  try {
    const parsed = listSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const items = parsed.data.filter((item) => item.text.trim());
      return items.length > 0 ? items : null;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

/** Parsuje cele / UVP — JSON (nowy format) lub legacy markdown. */
export function parseStrategyListItems(
  content: string | null | undefined
): StrategyListItem[] {
  if (!content?.trim()) return [];

  const trimmed = content.trim();

  // Próba parsowania jako JSON array
  if (trimmed.startsWith("[")) {
    const items = tryParseJsonList(trimmed);
    if (items) {
      // Jeśli jest dokładnie 1 element i jego text wygląda jak JSON array — "un-nest"
      if (items.length === 1 && items[0].text.trimStart().startsWith("[")) {
        const nested = tryParseJsonList(items[0].text.trim());
        if (nested) return nested;
      }
      return items;
    }
  }

  return parseLegacyMarkdown(trimmed);
}

export function serializeStrategyListItems(items: StrategyListItem[]): string {
  return JSON.stringify(
    items
      .map((item) => ({
        id: item.id,
        text: item.text.trim(),
        note: item.note.trim(),
        weight: item.weight,
      }))
      .filter((item) => item.text)
  );
}

/** Eksport do Notion / PDF — czytelny markdown z wagą i notatką. */
export function strategyListItemsToMarkdown(
  content: string | null | undefined
): string {
  const items = parseStrategyListItems(content);
  if (items.length === 0) return "—";

  return items
    .map((item) => {
      const weightLabel = WEIGHT_LABELS[item.weight];
      let block = `- **[${weightLabel}]** ${item.text}`;
      if (item.note.trim()) {
        block += `\n  _Notatka:_ ${item.note.trim()}`;
      }
      return block;
    })
    .join("\n\n");
}

export function listItemsPreview(
  content: string | null | undefined,
  maxItems = 2
): string {
  const items = parseStrategyListItems(content);
  if (items.length === 0) return "";
  const preview = items
    .slice(0, maxItems)
    .map((item) => item.text)
    .join(" · ");
  if (items.length > maxItems) {
    return `${preview}… (+${items.length - maxItems})`;
  }
  return preview;
}

/** @deprecated Użyj parseStrategyListItems */
export function parseListItems(content: string | null | undefined): string[] {
  return parseStrategyListItems(content).map((item) => item.text);
}

/** @deprecated Użyj serializeStrategyListItems */
export function serializeListItems(items: string[]): string {
  return serializeStrategyListItems(
    items.map((text) => createStrategyListItem(text))
  );
}

export function weightBorderClass(weight: StrategyListWeight): string {
  const map: Record<StrategyListWeight, string> = {
    1: "border-l-emerald-500",
    2: "border-l-amber-500",
    3: "border-l-destructive",
  };
  return map[weight];
}

export function weightBgClass(weight: StrategyListWeight): string {
  const map: Record<StrategyListWeight, string> = {
    1: "bg-emerald-500/8",
    2: "bg-amber-500/10",
    3: "bg-destructive/8",
  };
  return map[weight];
}

export function weightBadgeClass(weight: StrategyListWeight): string {
  const map: Record<StrategyListWeight, string> = {
    1: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    2: "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-400",
    3: "border-destructive/40 bg-destructive/15 text-destructive",
  };
  return map[weight];
}

export function weightPickerActiveClass(weight: StrategyListWeight): string {
  const map: Record<StrategyListWeight, string> = {
    1: "bg-emerald-500/10 text-emerald-400",
    2: "bg-amber-500/10 text-orange-400",
    3: "bg-destructive/10 text-destructive",
  };
  return map[weight];
}
