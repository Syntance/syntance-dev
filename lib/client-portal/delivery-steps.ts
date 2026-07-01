/**
 * 7-krokowy tracker dostawy projektu dla dashboardu klienta (Faza 16, M2).
 * Osobny od agencyjnego `OnboardingWizard` (który prowadzi zespół Syntance
 * przez wypełnianie strategii w Strategy Hub) — ten tracker to widok
 * READ-ONLY dla klienta końcowego, pokazujący gdzie jest jego projekt.
 *
 * `projects.delivery_status` (varchar, wolny tekst) trzyma klucz aktualnego
 * kroku — rozszerzenie z 5 do 7 wartości jest bezpieczne (brak enum w DB,
 * jedyny inny konsument to `lib/client-portal/queries.ts#toPortalProject`).
 */
export interface DeliveryStep {
  key: string;
  label: string;
  description: string;
}

export const DELIVERY_STEPS: DeliveryStep[] = [
  {
    key: "kickoff",
    label: "Kickoff",
    description: "Spotkanie startowe, cele i zakres projektu ustalone.",
  },
  {
    key: "discovery",
    label: "Discovery",
    description: "Strategia biznesowa, segmenty i konkurencja zebrane.",
  },
  {
    key: "design",
    label: "Projektowanie",
    description: "Makiety i design system w przygotowaniu.",
  },
  {
    key: "development",
    label: "Development",
    description: "Budowa strony/aplikacji wg zatwierdzonego projektu.",
  },
  {
    key: "qa",
    label: "Testowanie",
    description: "Testy funkcjonalne, wydajnościowe i dostępności.",
  },
  {
    key: "review",
    label: "Review klienta",
    description: "Twoja akceptacja przed publikacją.",
  },
  {
    key: "live",
    label: "Live",
    description: "Projekt opublikowany i działa na produkcji.",
  },
];

export function deliveryStepIndex(status: string): number {
  const idx = DELIVERY_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}
