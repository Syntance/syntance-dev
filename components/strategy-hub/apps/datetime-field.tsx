"use client";

import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DateInputField,
  TimeInputField,
} from "@/components/strategy-hub/apps/custom-pickers";

export interface DateTimeValue {
  date: string;
  hour: string;
  minute: string;
}

export function toDateTimeValue(date = new Date()): DateTimeValue {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
  };
}

export function dateTimeValueToIso(value: DateTimeValue): string {
  return new Date(`${value.date}T${value.hour}:${value.minute}:00`).toISOString();
}

export function formatDateTime24(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface DateTimeFieldProps {
  label: string;
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  className?: string;
}

export function DateTimeField({
  label,
  value,
  onChange,
  className,
}: DateTimeFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Data
          </span>
          <DateInputField
            value={value.date}
            onChange={(date) => onChange({ ...value, date })}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Godzina (24h)
            </span>
            <Clock3 className="size-3.5 text-muted-foreground" aria-hidden />
          </div>
          <TimeInputField
            hour={value.hour}
            minute={value.minute}
            onChange={(hour, minute) => onChange({ ...value, hour, minute })}
          />
          <p className="text-[10px] text-muted-foreground">
            Wpisz ręcznie np. 14:37 lub wybierz z listy
          </p>
        </div>
      </div>
    </div>
  );
}
