import "server-only";

import type { WorkType } from "./time-tracking-types";

export {
  WORK_TYPES,
  WORK_TYPE_LABELS,
  isWorkType,
} from "./time-tracking-types";
export type {
  WorkType,
  TimeEntryRow,
  DaySummary,
  WorkTypeSummary,
  SummaryResult,
} from "./time-tracking-types";

export function computeDurationMinutes(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(diffMs / 60_000));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatHoursDecimal(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function resolveHourlyRate(
  workType: WorkType,
  rates: {
    hourlyRateDevelopment: number | null;
    hourlyRateMaintenance: number | null;
  }
): number | null {
  return workType === "maintenance"
    ? rates.hourlyRateMaintenance
    : rates.hourlyRateDevelopment;
}

