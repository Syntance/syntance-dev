import { CheckCircle2, Circle } from "lucide-react";
import { DELIVERY_STEPS, deliveryStepIndex } from "@/lib/client-portal/delivery-steps";
import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
}

/**
 * Tracker dostawy projektu (7 kroków) — dashboard klienta, Faza 16 (M2).
 * Read-only: klient widzi postęp, nie edytuje go (edycja = agencja, w Hubie).
 */
export function ClientOnboardingTracker({ status }: Props) {
  const currentIdx = deliveryStepIndex(status);
  const current = DELIVERY_STEPS[currentIdx];

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm">Status realizacji</h2>
        <Badge
          variant={current.key === "live" ? "default" : "secondary"}
          className={
            current.key === "live"
              ? "bg-success/20 text-success border-success/30"
              : ""
          }
        >
          {current.label}
        </Badge>
      </div>

      <div className="relative">
        <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-border" />
        <div
          className="absolute top-3.5 left-3.5 h-0.5 bg-brand transition-all duration-500"
          style={{
            width: `${(currentIdx / (DELIVERY_STEPS.length - 1)) * 100}%`,
          }}
        />

        <div className="relative flex justify-between">
          {DELIVERY_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-2 px-0.5">
                <div
                  className={`size-7 rounded-full border-2 flex items-center justify-center z-10 bg-background transition-colors ${
                    done
                      ? "border-brand bg-brand"
                      : active
                        ? "border-brand bg-brand/10"
                        : "border-border"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-3.5 text-white" />
                  ) : (
                    <Circle
                      className={`size-3 ${active ? "text-brand" : "text-muted-foreground/30"}`}
                    />
                  )}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] font-medium hidden sm:block text-center max-w-[64px] leading-tight ${
                    active
                      ? "text-brand"
                      : done
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
        {current.description}
      </p>
    </div>
  );
}
