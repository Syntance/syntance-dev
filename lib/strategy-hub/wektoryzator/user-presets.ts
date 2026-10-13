/**
 * Własne presety użytkownika — zapisane ustawienia wektoryzacji (localStorage, walidacja Zod
 * przy odczycie: uszkodzone lub stare wpisy są pomijane, nie psują edytora).
 */
import { z } from "zod";
import { traceSettingsSchema, type TraceSettings } from "./engine/settings";

export const USER_PRESETS_STORAGE_KEY = "wektoryzator:presets:v1";
export const MAX_USER_PRESETS = 24;

const userPresetSchema = z.object({
  id: z.string().regex(/^[a-f0-9-]{36}$/),
  name: z.string().trim().min(1).max(40),
  settings: traceSettingsSchema,
});

export type UserPreset = z.infer<typeof userPresetSchema>;

export function parseUserPresets(input: unknown): UserPreset[] {
  if (!Array.isArray(input)) return [];
  const presets: UserPreset[] = [];
  for (const item of input.slice(0, MAX_USER_PRESETS)) {
    const parsed = userPresetSchema.safeParse(item);
    if (parsed.success) presets.push(parsed.data);
  }
  return presets;
}

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = window.localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    return raw ? parseUserPresets(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function storeUserPresets(presets: readonly UserPreset[]): void {
  try {
    window.localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Zablokowany storage — presety działają do końca sesji.
  }
}

export function createUserPreset(name: string, settings: TraceSettings): UserPreset {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40) || "Mój preset",
    settings: { ...settings, preset: "custom" },
  };
}
