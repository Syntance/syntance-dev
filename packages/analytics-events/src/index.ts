/**
 * @syntance/analytics-events — słownik zdarzeń analitycznych Strategy Hub.
 *
 * Zero zależności runtime — pakiet konsumowalny samodzielnie (np. przez
 * skrypt trackingowy na stronie klienta, niezależnie od reszty monorepo).
 * Wewnątrz Strategy Hub importowany jako `@/packages/analytics-events/src`.
 */

export type AnalyticsEventCategory =
  | "page_view"
  | "engagement"
  | "lead"
  | "conversion"
  | "retention";

/** Faza lejka (TOFU/MOFU/BOFU/retencja) — zgodnie z `purchaseStages.phase`. */
export type AnalyticsEventPhase = "TOFU" | "MOFU" | "BOFU" | "retention";

export interface AnalyticsEventDef {
  /** Stabilny klucz zdarzenia — zapisywany w `kpis.event_key` i `funnel_element_events.event_key`. */
  key: string;
  label: string;
  description: string;
  category: AnalyticsEventCategory;
  /** Czy zdarzenie liczy się jako konwersja (wpływa na reguły mierzalności CTA/KPI). */
  isConversion: boolean;
  /** Typowa faza lejka tego zdarzenia — źródło sugestii „event wg fazy" dla elementów lejka. */
  phase: AnalyticsEventPhase;
}

/**
 * Startowy katalog zdarzeń — pokrywa typowy lejek marketing/sales B2C i B2B.
 * Rozszerzalny bez migracji (klucz to `varchar`, nie enum bazodanowy).
 */
export const EVENT_REGISTRY: AnalyticsEventDef[] = [
  {
    key: "page_view",
    label: "Wyświetlenie strony",
    description: "Załadowanie dowolnej podstrony.",
    category: "page_view",
    isConversion: false,
    phase: "TOFU",
  },
  {
    key: "landing_view",
    label: "Wyświetlenie landing page",
    description: "Wejście na dedykowaną stronę lądowania (kampania/kanał).",
    category: "page_view",
    isConversion: false,
    phase: "TOFU",
  },
  {
    key: "scroll_75",
    label: "Scroll 75%",
    description: "Użytkownik przewinął ≥75% treści strony.",
    category: "engagement",
    isConversion: false,
    phase: "TOFU",
  },
  {
    key: "video_play",
    label: "Odtworzenie wideo",
    description: "Start odtwarzania materiału wideo.",
    category: "engagement",
    isConversion: false,
    phase: "TOFU",
  },
  {
    key: "video_complete",
    label: "Zakończenie wideo",
    description: "Obejrzenie wideo do końca (≥90%).",
    category: "engagement",
    isConversion: false,
    phase: "MOFU",
  },
  {
    key: "cta_click",
    label: "Kliknięcie CTA",
    description: "Kliknięcie głównego przycisku wezwania do działania.",
    category: "engagement",
    isConversion: false,
    phase: "MOFU",
  },
  {
    key: "phone_click",
    label: "Kliknięcie numeru telefonu",
    description: "Kliknięcie linku `tel:`.",
    category: "lead",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "email_click",
    label: "Kliknięcie adresu e-mail",
    description: "Kliknięcie linku `mailto:`.",
    category: "lead",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "chat_started",
    label: "Rozpoczęcie czatu",
    description: "Otwarcie/rozpoczęcie konwersacji na czacie (widget/WhatsApp).",
    category: "lead",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "lead_form_submit",
    label: "Wysłanie formularza leadowego",
    description: "Wypełnienie i wysłanie formularza kontaktowego/zapytania.",
    category: "lead",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "newsletter_signup",
    label: "Zapis do newslettera",
    description: "Potwierdzony zapis na listę mailingową.",
    category: "lead",
    isConversion: true,
    phase: "MOFU",
  },
  {
    key: "demo_request",
    label: "Zapytanie o demo",
    description: "Wysłanie prośby o demo/prezentację produktu.",
    category: "lead",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "download_asset",
    label: "Pobranie materiału",
    description: "Pobranie lead magnetu (e-book, cennik, case study).",
    category: "lead",
    isConversion: true,
    phase: "MOFU",
  },
  {
    key: "add_to_cart",
    label: "Dodanie do koszyka",
    description: "Dodanie produktu/usługi do koszyka.",
    category: "conversion",
    isConversion: false,
    phase: "BOFU",
  },
  {
    key: "checkout_start",
    label: "Start checkoutu",
    description: "Wejście w proces zakupowy (pierwszy krok).",
    category: "conversion",
    isConversion: false,
    phase: "BOFU",
  },
  {
    key: "purchase",
    label: "Zakup / zamknięcie sprzedaży",
    description: "Sfinalizowana transakcja lub podpisana umowa.",
    category: "conversion",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "booking_confirmed",
    label: "Potwierdzona rezerwacja",
    description: "Potwierdzona rezerwacja terminu/usługi (dla modeli usługowych).",
    category: "conversion",
    isConversion: true,
    phase: "BOFU",
  },
  {
    key: "return_visit",
    label: "Powracająca wizyta",
    description: "Kolejna wizyta tego samego użytkownika po konwersji.",
    category: "retention",
    isConversion: false,
    phase: "retention",
  },
  {
    key: "referral_share",
    label: "Polecenie / udostępnienie",
    description: "Użytkownik poleca produkt dalej (referral, share).",
    category: "retention",
    isConversion: true,
    phase: "retention",
  },
];

export function getEventByKey(key: string | null | undefined): AnalyticsEventDef | undefined {
  if (!key) return undefined;
  return EVENT_REGISTRY.find((e) => e.key === key);
}

export function isConversionEvent(key: string | null | undefined): boolean {
  return getEventByKey(key)?.isConversion ?? false;
}

export function eventsByCategory(category: AnalyticsEventCategory): AnalyticsEventDef[] {
  return EVENT_REGISTRY.filter((e) => e.category === category);
}

/** Zdarzenia typowe dla danej fazy lejka — źródło sugestii AI „event wg fazy". */
export function eventsByPhase(phase: AnalyticsEventPhase): AnalyticsEventDef[] {
  return EVENT_REGISTRY.filter((e) => e.phase === phase);
}

export const EVENT_CATEGORY_LABELS: Record<AnalyticsEventCategory, string> = {
  page_view: "Wyświetlenia",
  engagement: "Zaangażowanie",
  lead: "Lead",
  conversion: "Konwersja",
  retention: "Retencja",
};
