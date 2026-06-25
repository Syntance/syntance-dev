"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoToDisplayDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function parseDisplayDate(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970) return null;

  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const check = new Date(`${iso}T12:00:00`);
  if (
    check.getFullYear() !== year ||
    check.getMonth() + 1 !== month ||
    check.getDate() !== day
  ) {
    return null;
  }
  return iso;
}

export function formatTimeDisplay(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

export function parseTimeDisplay(input: string): { hour: string; minute: string } | null {
  const trimmed = input.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return { hour: pad2(h), minute: pad2(m) };
}

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => pad2(i));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => pad2(i));

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

interface PickerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const PickerTrigger = forwardRef<HTMLButtonElement, PickerTriggerProps>(
  function PickerTrigger({ children, className, type = "button", ...props }, ref) {
    return (
      <Button
        ref={ref}
        type={type}
        variant="outline"
        role="combobox"
        className={cn(
          "h-9 w-full justify-between gap-2 px-3 font-normal bg-card/50 hover:bg-card/80",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
PickerTrigger.displayName = "PickerTrigger";

interface TimeUnitPickerProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
  columns?: number;
  className?: string;
}

export function TimeUnitPicker({
  value,
  options,
  onChange,
  label,
  columns = 4,
  className,
}: TimeUnitPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      selectedRef.current?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PickerTrigger aria-label={label} aria-expanded={open} className={cn("flex-1 min-w-0", className)}>
          <span className="font-medium tabular-nums">{value}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PickerTrigger>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[100] w-[min(16rem,calc(100vw-2rem))] p-2 border-border bg-popover"
      >
        <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ScrollArea className="h-44">
          <div
            className="grid gap-1 pr-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                    selected
                      ? "bg-brand text-white font-medium shadow-[var(--brand-glow)]"
                      : "text-foreground hover:bg-muted/80"
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface DateCalendarPanelProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  allowClear?: boolean;
}

function DateCalendarPanel({
  value,
  onChange,
  onClose,
  allowClear = false,
}: DateCalendarPanelProps) {
  const [viewDate, setViewDate] = useState(() =>
    value ? parseIsoDate(value) : new Date()
  );

  useEffect(() => {
    if (value) setViewDate(parseIsoDate(value));
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayMonday = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthLabel = viewDate.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });

  const cells = useMemo(() => {
    const result: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < firstDayMonday; i++) {
      result.push({ day: null, key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ day, key: `day-${day}` });
    }
    return result;
  }, [daysInMonth, firstDayMonday]);

  function selectDay(day: number) {
    onChange(`${year}-${pad2(month + 1)}-${pad2(day)}`);
    onClose?.();
  }

  function shiftMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => shiftMonth(-1)}
          aria-label="Poprzedni miesiąc"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => shiftMonth(1)}
          aria-label="Następny miesiąc"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="flex h-7 items-center justify-center text-[10px] font-medium text-muted-foreground"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ day, key }) => {
          if (day === null) {
            return <span key={key} className="h-9" />;
          }
          const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const selected = value === iso;
          const isToday = iso === todayIso;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectDay(day)}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                selected
                  ? "bg-brand text-white font-medium shadow-[var(--brand-glow)]"
                  : isToday
                    ? "border border-brand/40 text-brand hover:bg-brand/10"
                    : "hover:bg-muted/80"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between border-t border-border pt-2">
        {allowClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              onChange("");
              onClose?.();
            }}
          >
            Wyczyść
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            onChange(todayIso);
            onClose?.();
          }}
        >
          Dziś
        </Button>
      </div>
    </>
  );
}

interface DateInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  allowClear?: boolean;
  placeholder?: string;
}

export function DateInputField({
  value,
  onChange,
  className,
  allowClear = false,
  placeholder = "DD.MM.RRRR",
}: DateInputFieldProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => isoToDisplayDate(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(isoToDisplayDate(value));
    setInvalid(false);
  }, [value]);

  function commitDate(raw: string) {
    const parsed = parseDisplayDate(raw);
    if (parsed) {
      onChange(parsed);
      setText(isoToDisplayDate(parsed));
      setInvalid(false);
      return true;
    }
    setText(isoToDisplayDate(value));
    setInvalid(false);
    return false;
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          if (text.trim() === "") return;
          if (!commitDate(text)) setInvalid(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim() === "") return;
            if (!commitDate(text)) setInvalid(true);
          }
        }}
        placeholder={placeholder}
        inputMode="numeric"
        aria-invalid={invalid}
        className={cn(
          "flex-1 tabular-nums bg-card/50",
          invalid && "border-destructive ring-destructive/20"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 bg-card/50"
            aria-label="Otwórz kalendarz"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="z-[100] w-[min(18rem,calc(100vw-2rem))] p-3 border-border bg-popover"
        >
          <DateCalendarPanel
            value={value}
            allowClear={allowClear}
            onChange={(iso) => {
              onChange(iso);
              setText(isoToDisplayDate(iso));
              setInvalid(false);
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface TimeInputFieldProps {
  hour: string;
  minute: string;
  onChange: (hour: string, minute: string) => void;
  className?: string;
}

export function TimeInputField({
  hour,
  minute,
  onChange,
  className,
}: TimeInputFieldProps) {
  const [open, setOpen] = useState(false);
  const display = formatTimeDisplay(hour, minute);
  const [text, setText] = useState(display);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatTimeDisplay(hour, minute));
    setInvalid(false);
  }, [hour, minute]);

  function commitTime(raw: string) {
    const parsed = parseTimeDisplay(raw);
    if (parsed) {
      onChange(parsed.hour, parsed.minute);
      setText(formatTimeDisplay(parsed.hour, parsed.minute));
      setInvalid(false);
      return true;
    }
    setText(display);
    setInvalid(false);
    return false;
  }

  return (
    <div className={cn("flex flex-1 items-center gap-2 min-w-0", className)}>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          if (text.trim() === "") return;
          if (!commitTime(text)) setInvalid(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim() === "") return;
            if (!commitTime(text)) setInvalid(true);
          }
        }}
        placeholder="GG:MM"
        inputMode="numeric"
        aria-label="Godzina w formacie 24h"
        aria-invalid={invalid}
        className={cn(
          "flex-1 tabular-nums text-center bg-card/50",
          invalid && "border-destructive ring-destructive/20"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 bg-card/50"
            aria-label="Wybierz godzinę z listy"
          >
            <ChevronsUpDown className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="z-[100] w-[min(20rem,calc(100vw-2rem))] p-2 border-border bg-popover"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Godzina
              </p>
              <ScrollArea className="h-44">
                <div className="grid grid-cols-4 gap-1 pr-2">
                  {HOUR_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        onChange(h, minute);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-sm tabular-nums",
                        h === hour
                          ? "bg-brand text-white font-medium"
                          : "hover:bg-muted/80"
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div>
              <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Minuta
              </p>
              <ScrollArea className="h-44">
                <div className="grid grid-cols-4 gap-1 pr-2">
                  {MINUTE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onChange(hour, m);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-sm tabular-nums",
                        m === minute
                          ? "bg-brand text-white font-medium"
                          : "hover:bg-muted/80"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
  allowClear?: boolean;
}

export function DatePickerField({
  value,
  onChange,
  className,
  allowClear = false,
}: DatePickerFieldProps) {
  return (
    <DateInputField
      value={value}
      onChange={onChange}
      className={className}
      allowClear={allowClear}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | null;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Wybierz…",
  label,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <PickerTrigger
            aria-label={label ?? placeholder}
            aria-expanded={open}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {selected?.icon != null && selected.icon !== "" ? (
                <span className="text-base leading-none">{selected.icon}</span>
              ) : null}
              <span className={cn("truncate", !selected && "text-muted-foreground")}>
                {selected?.label ?? placeholder}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </PickerTrigger>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[100] w-(--radix-popover-trigger-width) p-1 border-border bg-popover"
        >
          <ScrollArea className="max-h-60">
            <div className="p-1 space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value || "__all__"}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left transition-colors",
                      isSelected
                        ? "bg-brand/10 text-foreground"
                        : "hover:bg-muted/80"
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-brand",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.icon != null && option.icon !== "" ? (
                      <span className="text-base leading-none">{option.icon}</span>
                    ) : null}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
