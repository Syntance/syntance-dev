import "server-only";

import type { WorkType } from "./time-tracking-types";

export { WORK_TYPES, isWorkType } from "./time-tracking-types";
export type {
  WorkType,
  TimeEntryRow,
  WorkTypeSummary,
  SummaryResult,
} from "./time-tracking-types";

export function computeDurationMinutes(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(diffMs / 60_000));
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

