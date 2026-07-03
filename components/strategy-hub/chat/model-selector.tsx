"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CHAT_MODELS = [
  {
    id: "claude-opus-4-5",
    label: "Claude Opus 4.5",
    description: "Najsilniejszy — deep research, złożone analizy",
    badge: "Pro",
    badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    description: "Zrównoważony — idealny do codziennej pracy",
    badge: "Rekomendowany",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Szybki — krótkie pytania, edycje",
    badge: "Szybki",
    badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

interface ModelSelectorProps {
  value: ChatModelId;
  onChange: (value: ChatModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const current = CHAT_MODELS.find((m) => m.id === value) ?? CHAT_MODELS[1];

  return (
    <Select
      value={value}
        onValueChange={(v: string | null) => { if (v) onChange(v as ChatModelId); }}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-auto min-w-[11rem] text-xs gap-1.5 border-border/60 bg-card/50">
        <SelectValue>
          <span className="font-medium">{current.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="w-72">
        {CHAT_MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id} className="items-start py-2.5">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{m.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] h-4 px-1.5 border ${m.badgeColor}`}
                >
                  {m.badge}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{m.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
