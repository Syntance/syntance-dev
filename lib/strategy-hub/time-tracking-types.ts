export const WORK_TYPES = ["development", "maintenance"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  development: "Development",
  maintenance: "Utrzymanie",
};

export function isWorkType(value: string): value is WorkType {
  return WORK_TYPES.includes(value as WorkType);
}

export interface TimeEntryRow {
  id: string;
  projectId: string;
  projectName: string;
  projectIcon: string | null;
  userEmail: string;
  comment: string | null;
  workType: WorkType;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  hourlyRate: number | null;
}

export interface DaySummary {
  date: string;
  minutes: number;
  entries: number;
}

export interface WorkTypeSummary {
  workType: WorkType;
  minutes: number;
  hours: number;
  hourlyRate: number | null;
  amount: number | null;
  entryCount: number;
}

export interface ProjectHourlyRates {
  development: number | null;
  maintenance: number | null;
}

export interface SummaryResult {
  totalMinutes: number;
  totalHours: number;
  hourlyRates: ProjectHourlyRates;
  totalAmount: number | null;
  entryCount: number;
  byWorkType: WorkTypeSummary[];
  byDay: DaySummary[];
  byMonth: { month: string; minutes: number; entries: number }[];
}
