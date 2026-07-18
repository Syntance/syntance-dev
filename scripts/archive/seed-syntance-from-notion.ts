/**
 * Backfill projektu Syntance danymi z workspace Notion (syntance.com + strategia firmy).
 * Idempotentny — uzupełnia puste moduły, nie nadpisuje istniejących rekordów relacyjnych.
 *
 * Źródła:
 *  - Notion „syntance.com" (struktura strony, cele, stack, user flows)
 *  - Notion „Główne informacje - Syntance", „Pozycjonowanie 2025–2026", „Plan operacyjny H1 2026"
 *  - Live copy syntance.com (nawigacja, sekcje, CTA, stack technologiczny)
 *
 * Uruchomienie: pnpm tsx --env-file=.env.local scripts/seed-syntance-from-notion.ts
 * Dry-run:     pnpm tsx --env-file=.env.local scripts/seed-syntance-from-notion.ts --dry-run
 */
import "dotenv/config";
import { db } from "@/db";
import {
  brandIdentity,
  brandVisual,
  copyGuidelines,
  channels,
  pages,
  navItems,
  techStack,
  seoKeywords,
  sites,
  purchaseStages,
  funnelElements,
  userFlows,
  salesPitches,
  salesScripts,
  segments,
  projects,
} from "@/db/schema";
import { eq, and, isNull, count, sql, ilike } from "drizzle-orm";

const PID = "c9572f7f-feb5-42f6-b5d6-1b489fd66488";
const WORKSPACE_ID = "02354552-3b71-4080-95a5-3cf9e2e946f1";
const NOTION_PAGE_URL =
  "https://www.notion.so/syntance-com-22b7ef9daea78068b7e6c66f55f7e815";

// ─── Marka (Notion: Główne informacje + Pozycjonowanie) ─────────────────────

const missionMd =
  "Budować strony i sklepy, które realnie sprzedają — łącząc strategię biznesową, UX i inżynierię wysokiej wydajności w jednym procesie, bez narzutu agencyjnego.";

const visionMd =
  "Syntance ma być w Polsce synonimem „butikowego studia Next.js” — wyborem nr 1 dla rosnących marek MŚP, które chcą jakości premium bez kosztów enterprise i bez ryzyka freelancera.";

const purposeMd = `**Slogan:** *Strony i sklepy, które działają, nie wyglądają.*

Polski rynek web developmentu jest spolaryzowany: tani freelancer, który znika po launchu, albo droga agencja, gdzie sprzedaje senior, a dowozi stażysta. **Syntance powstało w luce między nimi — trzecia droga: jakość premium w cenie poniżej agencji, ze strategią przedwdrożeniową w standardzie i jednym partnerem odpowiedzialnym za cały projekt.**

Butikowe studio Next.js, które łączy strategię biznesową, projektowanie UX i inżynierię wysokiej wydajności w jednym, spójnym procesie.`;

const brandPillarsMd = `1. **Strategy-first** — nie piszemy linijki kodu, dopóki nie udowodnimy uzasadnienia biznesowego. Każdy detal realizuje cel.
2. **Mierzalny rezultat** — projektujemy systemy, które mierzymy (konwersja, leady, ROI), a nie „ładne strony, które miło wyglądają”.
3. **Technologia w służbie konwersji** — Next.js, Sanity, PostHog, EAA w standardzie. Stack dobierany pod cel biznesowy, nie pod modę.
4. **Founder-led, nie freelancer-led** — kameralny zespół z jednym partnerem odpowiedzialnym za całość + rozszerzona sieć specjalistów (copywriter, prawnik B2B, designer, analityk SEO) + narzędzia AI (Cursor, v0).`;

const toneOfVoiceMd = `**Charakter:** strategiczny, mierzalny, bezpośredni i autentyczny. Premium bez korporacyjnej zadęcia.

**Zasady:**
- **„My w Syntance”, nie „ja”** — firma na pierwszym planie, founder w służbie marki.
- **Konkret zamiast korpomowy** — „+47% konwersji w 3 miesiące” zamiast „wysokiej jakości rozwiązania”.
- **Kontrast jako narzędzie sprzedaży** — „nie tani WP, nie drogie enterprise — trzecia droga”.
- **Bezpośredniość** — „Twoja strona nie sprzedaje”, „Ty”, nie „Państwo”.
- **Krótkie zdania, dużo białego znaku** — zero ścian tekstu.

**Przykład tonu:** „Syntance projektuje sklepy Next.js, które konwertują 2× lepiej niż na Shopify — bez narzutu agencyjnego.”`;

const brandPersonalityMd = `**Founder-led brand** — Kamil jest „głosem Syntance”, twarzą studia, ale klient kupuje **Syntance**, nie „Kamila Podobińskiego”. Marka skaluje się niezależnie od osoby.`;

const principlesMd = `Zasady komunikacji obowiązują we WSZYSTKICH kanałach (strona, LinkedIn, blog, email, eventy, outbound).

- Pozycjonujemy **firmę, nie osobę** — „My w Syntance”, nie „ja”.
- **Konkret i liczby** zamiast przymiotników.
- **Kontrast** — „nie tani WP, nie drogie enterprise — trzecia droga”.
- **Bezpośredniość** — „Ty”, krótkie zdania.`;

const doMd = `- „My w Syntance”, „Syntance robi”
- „+47% konwersji w 3 miesiące” (konkret, liczba)
- „Nie tani WP, nie drogie enterprise — trzecia droga”
- „Twoja strona nie sprzedaje” (bezpośredniość)
- „Sklep w 4–8 tyg., nie w 6 miesięcy”`;

const dontMd = `- „Ja”, „Kamil zrobi”
- „Wysokiej jakości rozwiązania” (ogólnik)
- „Pomagamy poprawić Państwa wyniki” (korpomowa)
- Słowa-tabu: „leciutko”, „ładnie”, „fajnie”, „freelancer”, „rewolucja” bez konkretu`;

const copyTemplates = [
  {
    name: "Post LinkedIn (case study)",
    body: "W Syntance wdrożyliśmy [projekt] — [liczba] w [czas].\n\nProblem: [1 zdanie]\nRozwiązanie: Next.js + [stack]\nWynik: [metrika]\n\n→ pełny case: syntance.com/portfolio",
  },
  {
    name: "LinkedIn outbound DM",
    body: "Cześć [Imię], widzę że [firma] ma PageSpeed [X] na mobile. W Syntance budujemy strony Next.js z PS 90+ w 4–8 tyg. — bez narzutu agencyjnego. Chcesz 15-min screen z konkretem pod [firma]?",
  },
  {
    name: "Email follow-up po formularzu",
    body: "Cześć [Imię],\n\ndzięki za wiadomość z syntance.com. W Syntance zaczynamy od strategii — potem projekt i wdrożenie w jednym procesie.\n\nPropozycja: 30 min rozmowy w [termin]. Przygotuję 3 konkretne rekomendacje pod [cel].\n\nPozdrawiam,\nZespół Syntance",
  },
];

const copyExamples = [
  {
    label: "Dobry nagłówek hero",
    body: "Strony i sklepy, które sprzedają",
  },
  {
    label: "Dobry CTA",
    body: "Sprawdź cenę w 2 minuty",
  },
  {
    label: "Zły nagłówek (generyczny)",
    body: "Wysokiej jakości rozwiązania webowe dla Twojej firmy",
  },
];

// ─── Kanały (Notion: Plan operacyjny H1 2026) ────────────────────────────────

interface ChannelSeed {
  name: string;
  type: string;
  icon: string;
  description: string;
  status: "active" | "planned";
  costMonthly?: number;
}

const channelSeeds: ChannelSeed[] = [
  {
    name: "Siatka kontaktów / polecenia",
    type: "referral",
    icon: "🤝",
    status: "active",
    description:
      "Główny silnik cashflow H1 2026. DM-y do ~20 osób + follow-up. Cel: pierwsza faktura ≥5k w 14 dni.",
  },
  {
    name: "LinkedIn outbound",
    type: "outbound",
    icon: "💼",
    status: "active",
    description:
      "10 wiadomości/dzień do CEO B2B 10–49 osób ze słabym PageSpeed (<50).",
  },
  {
    name: "LinkedIn organic",
    type: "social",
    icon: "📣",
    status: "active",
    description: "2 posty/tydzień z konkretem (case study, technical breakdown).",
  },
  {
    name: "Upwork (wycelowany)",
    type: "marketplace",
    icon: "🌐",
    status: "active",
    description: "Tylko Next.js / Sanity / Medusa / headless. Min. $1500 fixed.",
  },
  {
    name: "Case studies (syntance.com)",
    type: "content",
    icon: "📄",
    status: "active",
    description: "RetroHouse + Lumine — 1 strona + 3 screeny + 3 liczby każdy.",
  },
  {
    name: "SEO syntance.com",
    type: "SEO",
    icon: "🔍",
    status: "active",
    description: "H1: tylko `/`, `/cennik`, `/strony-www` (reszta zamrożona).",
  },
  {
    name: "Blog SEO",
    type: "content",
    icon: "📝",
    status: "planned",
    description: "Zamrożone do Q4 2026.",
  },
  {
    name: "Google Ads",
    type: "ads",
    icon: "🎯",
    status: "planned",
    costMonthly: 2500,
    description: "Uruchamiamy po stabilnym cashflow.",
  },
];

// ─── Strona WWW (Notion syntance.com + live copy) ────────────────────────────

const SITE_GOAL =
  "Edukacja i konwersja → sprzedaż. Główny landing ruchu organicznego i płatnego.";

interface PageSeed {
  name: string;
  urlPath: string;
  type: string;
  status: string;
  priority: number;
  cta?: string;
  goal?: string;
  roleInFunnel?: string;
}

const pageSeeds: PageSeed[] = [
  {
    name: "Strona główna",
    urlPath: "/",
    type: "landing",
    status: "live",
    priority: 1,
    cta: "Sprawdź cenę",
    goal: SITE_GOAL,
    roleInFunnel: "TOFU/MOFU — edukacja (strategia → UX → tech) + konwersja na cennik",
  },
  {
    name: "Oferta",
    urlPath: "/oferta",
    type: "product",
    status: "live",
    priority: 2,
    cta: "Umów rozmowę",
    goal: "Prezentacja usług: strony, sklepy, dla agencji",
    roleInFunnel: "MOFU — kwalifikacja potrzeb",
  },
  {
    name: "Produkty",
    urlPath: "/produkty",
    type: "product",
    status: "live",
    priority: 3,
    cta: "Sprawdź cenę",
    roleInFunnel: "MOFU — porównanie pakietów",
  },
  {
    name: "Portfolio",
    urlPath: "/portfolio",
    type: "case-study",
    status: "live",
    priority: 4,
    cta: "Zobacz case study",
    goal: "Dowód społeczny — RetroHouse, Lumine Concept",
    roleInFunnel: "MOFU — trust building",
  },
  {
    name: "Cennik",
    urlPath: "/cennik",
    type: "pricing",
    status: "live",
    priority: 2,
    cta: "Wyślij formularz",
    goal: "Interaktywny konfigurator — wycena w 2 minuty, konwersja na lead",
    roleInFunnel: "BOFU — kwalifikacja budżetu i zakresu",
  },
  {
    name: "Kontakt",
    urlPath: "/kontakt",
    type: "contact",
    status: "live",
    priority: 5,
    cta: "Wyślij wiadomość",
    goal: "Formularz kontaktowy + dane kontaktowe",
    roleInFunnel: "BOFU — lead capture",
  },
  {
    name: "Strony internetowe",
    urlPath: "/strony-www",
    type: "landing",
    status: "live",
    priority: 2,
    cta: "Sprawdź cenę strony",
    goal: "Landing SEO — strony Next.js dla MŚP",
    roleInFunnel: "TOFU — ruch organiczny (SEO H1)",
  },
  {
    name: "Sklepy internetowe",
    urlPath: "/sklepy",
    type: "product",
    status: "live",
    priority: 3,
    cta: "Sprawdź cenę sklepu",
    roleInFunnel: "MOFU — e-commerce headless",
  },
  {
    name: "Dla agencji",
    urlPath: "/dla-agencji",
    type: "landing",
    status: "live",
    priority: 4,
    cta: "White-label",
    goal: "Track White-Label — partnerstwo z agencjami marketingowymi",
    roleInFunnel: "MOFU — segment Ania (WL)",
  },
  {
    name: "Panel klienta",
    urlPath: "/panel",
    type: "product",
    status: "live",
    priority: 6,
    cta: "Zobacz demo",
    goal: "Showcase Syntance Panel — CMS + sklep + analityka w jednym",
    roleInFunnel: "MOFU — diferencjacja produktowa",
  },
  {
    name: "O nas",
    urlPath: "/o-nas",
    type: "landing",
    status: "live",
    priority: 7,
    cta: "Poznaj nas",
    roleInFunnel: "MOFU — trust, founder-led brand",
  },
  {
    name: "Blog",
    urlPath: "/blog",
    type: "blog",
    status: "draft",
    priority: 8,
    goal: "Zamrożony do Q4 2026 (Plan operacyjny H1)",
    roleInFunnel: "TOFU — SEO długi ogon (future)",
  },
  {
    name: "Polityka prywatności",
    urlPath: "/polityka-prywatnosci",
    type: "legal",
    status: "live",
    priority: 99,
    roleInFunnel: "Compliance — RODO",
  },
  {
    name: "Regulamin",
    urlPath: "/regulamin",
    type: "legal",
    status: "live",
    priority: 99,
    roleInFunnel: "Compliance",
  },
];

const navSeeds = [
  { label: "Strona główna", url: "/", position: "header", orderIdx: 0 },
  { label: "Oferta", url: "/oferta", position: "header", orderIdx: 1 },
  { label: "Produkty", url: "/produkty", position: "header", orderIdx: 2 },
  { label: "Portfolio", url: "/portfolio", position: "header", orderIdx: 3 },
  { label: "Blog", url: "/blog", position: "header", orderIdx: 4 },
  { label: "Cennik", url: "/cennik", position: "header", orderIdx: 5 },
  { label: "Kontakt", url: "/kontakt", position: "header", orderIdx: 6 },
];

interface TechSeed {
  name: string;
  category: string;
  description: string;
  url?: string;
  status: string;
}

const techSeeds: TechSeed[] = [
  {
    name: "Next.js",
    category: "framework",
    description: "App Router, RSC, PageSpeed 90+. Standard Netflix, TikTok, Nike.",
    url: "https://nextjs.org",
    status: "active",
  },
  {
    name: "Sanity CMS",
    category: "cms",
    description: "Headless CMS — treści bez wtyczek, structured content.",
    url: "https://sanity.io",
    status: "active",
  },
  {
    name: "Medusa.js",
    category: "ecommerce",
    description: "Headless commerce — sklepy bez Shopify lock-in.",
    url: "https://medusajs.com",
    status: "active",
  },
  {
    name: "Vercel",
    category: "hosting",
    description: "Edge hosting, preview deployments, analytics.",
    url: "https://vercel.com",
    status: "active",
  },
  {
    name: "Railway",
    category: "hosting",
    description: "Backend / Medusa / Postgres w produkcji.",
    url: "https://railway.app",
    status: "active",
  },
  {
    name: "Cloudflare R2",
    category: "storage",
    description: "Asset storage, CDN — bez vendor lock-in S3.",
    url: "https://cloudflare.com/r2",
    status: "active",
  },
  {
    name: "GitHub",
    category: "devops",
    description: "Repo klienta od dnia 1 — pełna własność kodu.",
    url: "https://github.com",
    status: "active",
  },
  {
    name: "PostHog",
    category: "analytics",
    description: "Analityka produktowa, funnels, session replay — privacy-first.",
    url: "https://posthog.com",
    status: "active",
  },
];

const seoSeeds = [
  {
    phrase: "studio next.js polska",
    intent: "commercial",
    funnelStage: "tofu",
    priority: 1,
    status: "active",
  },
  {
    phrase: "strony internetowe next.js",
    intent: "commercial",
    funnelStage: "tofu",
    priority: 2,
    status: "active",
  },
  {
    phrase: "sklep internetowy headless",
    intent: "commercial",
    funnelStage: "mofu",
    priority: 3,
    status: "active",
  },
];

// ─── Lejek (per segment) ─────────────────────────────────────────────────────

const FUNNEL_PHASES = [
  { phase: "tofu", name: "Świadomość (TOFU)", orderIdx: 0 },
  { phase: "mofu", name: "Rozważanie (MOFU)", orderIdx: 1 },
  { phase: "bofu", name: "Decyzja (BOFU)", orderIdx: 2 },
  { phase: "retention", name: "Retencja", orderIdx: 3 },
] as const;

interface FunnelElementSeed {
  phase: (typeof FUNNEL_PHASES)[number]["phase"];
  name: string;
  format: string;
  cta?: string;
  ctaUrl?: string;
  contentMd?: string;
}

const b2bFunnelElements: FunnelElementSeed[] = [
  {
    phase: "tofu",
    name: "LinkedIn outbound DM",
    format: "outbound",
    contentMd: "10 DM/dzień do CEO B2B 10–49 osób, PageSpeed <50.",
  },
  {
    phase: "tofu",
    name: "Post LinkedIn organic",
    format: "social",
    contentMd: "Case study / technical breakdown — 2×/tydzień.",
  },
  {
    phase: "tofu",
    name: "Polecenie z siatki kontaktów",
    format: "referral",
    contentMd: "DM do ~20 osób + follow-up po 3 dniach.",
  },
  {
    phase: "mofu",
    name: "Landing syntance.com",
    format: "page",
    cta: "Sprawdź cenę",
    ctaUrl: "/cennik",
    contentMd: "Hero + 3 filary procesu (strategia → UX → dev).",
  },
  {
    phase: "mofu",
    name: "Case study RetroHouse / Lumine",
    format: "case-study",
    cta: "Zobacz portfolio",
    ctaUrl: "/portfolio",
  },
  {
    phase: "mofu",
    name: "Strona /strony-www (SEO)",
    format: "page",
    cta: "Sprawdź cenę strony",
    ctaUrl: "/cennik",
  },
  {
    phase: "bofu",
    name: "Konfigurator cennika",
    format: "tool",
    cta: "Wyślij formularz",
    ctaUrl: "/cennik",
    contentMd: "Interaktywny konfigurator — wycena w 2 min, lead capture.",
  },
  {
    phase: "bofu",
    name: "Formularz kontaktowy",
    format: "form",
    cta: "Wyślij wiadomość",
    ctaUrl: "/kontakt",
  },
  {
    phase: "bofu",
    name: "Rozmowa discovery (30 min)",
    format: "call",
    contentMd: "Kwalifikacja + 3 rekomendacje. Cel: oferta ≥5k PLN.",
  },
  {
    phase: "retention",
    name: "Abonament opieki",
    format: "service",
    contentMd: "Utrzymanie, aktualizacje, monitoring PageSpeed po wdrożeniu.",
  },
];

// ─── Przekaz (pitche + skrypty) ─────────────────────────────────────────────

const pitchSeeds = [
  {
    context: "elevator",
    title: "Elevator pitch (30 s)",
    pitchMd:
      "Syntance to butikowe studio Next.js. Łączymy strategię biznesową, UX i inżynierię w jednym procesie — strony i sklepy, które realnie sprzedają. Nie tani freelancer, nie droga agencja — trzecia droga. PageSpeed 90+, własność kodu od dnia 1.",
    status: "approved",
  },
  {
    context: "linkedin",
    title: "Pitch LinkedIn outbound",
    pitchMd:
      "W Syntance budujemy strony Next.js z PageSpeed 90+ w 4–8 tyg. — strategy-first, bez narzutu agencyjnego. Widzę, że [firma] ma PS [X] na mobile. 15 min — pokażę 3 konkretne quick wins pod Wasz lejek.",
    status: "approved",
  },
  {
    context: "call",
    title: "Pitch rozmowy discovery",
    pitchMd:
      "Zanim pokażę cokolwiek — chcę zrozumieć cel biznesowy. W Syntance nie zaczynamy od grafiki, tylko od strategii: kto kupuje, dlaczego Wy, jaki KPI. Potem projekt i wdrożenie w jednym procesie — stała cena, 30% zadatek, reszta przy odbiorze.",
    status: "approved",
  },
];

const scriptSeeds = [
  {
    context: "linkedin_dm",
    name: "Skrypt LinkedIn outbound (B2B Direct)",
    scriptMd: `1. Personalizacja: „Cześć [Imię], widzę że [firma]…”
2. Hook: PageSpeed / konwersja / stary WP
3. Dowód: „W Syntance wdrożyliśmy [case] — [liczba]”
4. CTA: „15 min screen — pokażę 3 quick wins. [termin]?”
5. Floor: min. projekt 5k PLN w treści follow-up`,
    status: "approved",
  },
  {
    context: "discovery_call",
    name: "Skrypt rozmowy discovery (30 min)",
    scriptMd: `**0–5 min:** Cel biznesowy klienta, obecny stack, deadline
**5–15 min:** Buyer persona, UVP, główna obiekcja
**15–25 min:** 3 rekomendacje + rough scope
**25–30 min:** Następny krok — oferta strategy-first (7 800 PLN) lub wdrożenie
**Zamknięcie:** „Wyślę propozycję do [data]. Zadatek 30%, reszta przy odbiorze.”`,
    status: "approved",
  },
  {
    context: "follow_up",
    name: "Skrypt follow-up po formularzu cennika",
    scriptMd: `Email w 24h:
„Cześć [Imię], dzięki za konfigurację na syntance.com.
Widzę że wybrałeś [pakiet] — szacunek [X] PLN / [Y] tyg.
Propozycja: 30 min rozmowy [termin A/B].
Przygotuję 3 rekomendacje pod [cel z formularza].”`,
    status: "approved",
  },
];

// ─── User flows (Notion: User Flows) ────────────────────────────────────────

const userFlowSeeds = [
  {
    segmentPattern: "B2B",
    name: "Landing → Cennik → Lead (B2B Direct)",
    type: "conversion",
    conversionGoal: "Formularz wysłany z konfiguratora cennika",
    stepsMd: `1. **Wejście:** Google / LinkedIn / polecenie → syntance.com/
2. **Edukacja:** Scroll hero → sekcja „My od biznesu” → technologia
3. **Intent:** Klik „Sprawdź cenę” → /cennik
4. **Konfiguracja:** Wybór typu (strona/sklep), zakresu, funkcji
5. **Konwersja:** Formularz + zgoda RODO → lead w CRM
6. **Follow-up:** Email 24h + propozycja rozmowy 30 min`,
    status: "active",
  },
  {
    segmentPattern: "B2B",
    name: "LinkedIn outbound → Discovery → Oferta",
    type: "sales",
    conversionGoal: "Podpisana oferta ≥5 000 PLN",
    stepsMd: `1. Outbound DM (10/dzień)
2. Odpowiedź pozytywna → calendar link
3. Discovery 30 min (skrypt)
4. Oferta strategy-first lub wdrożenie
5. Zadatek 30% → start projektu`,
    status: "active",
  },
  {
    segmentPattern: "White-Label",
    name: "Inbound agencja → NDA → White-label projekt",
    type: "partnership",
    conversionGoal: "NDA + pierwszy projekt WL",
    stepsMd: `1. Inbound (LinkedIn / polecenie)
2. Pitch white-label + portfolio
3. NDA + model współpracy
4. Pierwszy projekt pod marką agencji
5. Retainer / kolejne projekty`,
    status: "draft",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function rowCount(
  table: { projectId: unknown },
  where: ReturnType<typeof and>
): Promise<number> {
  const rows: { c: number }[] = await db
    .select({ c: count() })
    .from(table as never)
    .where(where);
  return rows[0]?.c ?? 0;
}

async function findSegment(pattern: string) {
  const [row] = await db
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(
      and(
        eq(segments.projectId, PID),
        isNull(segments.deletedAt),
        ilike(segments.name, `%${pattern}%`)
      )
    )
    .limit(1);
  return row ?? null;
}

async function ensurePrimarySite(dryRun: boolean): Promise<string | null> {
  const [existing] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(eq(sites.projectId, PID), eq(sites.isPrimary, true), isNull(sites.deletedAt))
    )
    .limit(1);
  if (existing) return existing.id;

  if (dryRun) {
    console.log("[dry-run] sites → INSERT primary syntance.com");
    return "dry-run-site-id";
  }

  const [created] = await db
    .insert(sites)
    .values({
      projectId: PID,
      name: "syntance.com",
      domain: "syntance.com",
      type: "main",
      isPrimary: true,
      status: "active",
    })
    .returning({ id: sites.id });
  console.log("✓ Primary site syntance.com utworzony");
  return created.id;
}

async function seedProjectMeta(dryRun: boolean) {
  const [proj] = await db
    .select({ notionPageUrl: projects.notionPageUrl, domain: projects.domain })
    .from(projects)
    .where(eq(projects.id, PID))
    .limit(1);

  const updates: Record<string, string> = {};
  if (!proj?.notionPageUrl) updates.notionPageUrl = NOTION_PAGE_URL;
  if (!proj?.domain) updates.domain = "syntance.com";

  if (Object.keys(updates).length === 0) {
    console.log("• Projekt — notionPageUrl i domain już ustawione");
    return;
  }
  if (dryRun) {
    console.log("[dry-run] projects → UPDATE", updates);
    return;
  }
  await db.update(projects).set(updates).where(eq(projects.id, PID));
  console.log("✓ Projekt — notionPageUrl + domain");
}

async function seedBrand(dryRun: boolean) {
  const [bi] = await db
    .select()
    .from(brandIdentity)
    .where(eq(brandIdentity.projectId, PID));
  if (bi) {
    console.log("• brandIdentity już istnieje — pomijam");
  } else if (dryRun) {
    console.log("[dry-run] brandIdentity → INSERT");
  } else {
    await db.insert(brandIdentity).values({
      projectId: PID,
      missionMd,
      visionMd,
      purposeMd,
      brandPillarsMd,
      toneOfVoiceMd,
      brandPersonalityMd,
    });
    console.log("✓ brandIdentity");
  }

  const [bv] = await db
    .select()
    .from(brandVisual)
    .where(eq(brandVisual.projectId, PID));
  if (bv) {
    console.log("• brandVisual już istnieje — pomijam");
  } else if (dryRun) {
    console.log("[dry-run] brandVisual → INSERT");
  } else {
    await db.insert(brandVisual).values({
      projectId: PID,
      colors: [
        { name: "Brand", hex: "#6d28d9", role: "primary" },
        { name: "Brand Light", hex: "#8b5cf6", role: "accent" },
        { name: "Background", hex: "#09090b", role: "background" },
        { name: "Foreground", hex: "#fafafa", role: "text" },
      ],
      typography: [
        { role: "display", family: "Geist", weights: "600,700" },
        { role: "body", family: "Geist", weights: "400,500" },
      ],
      usageGuidelinesMd:
        "Ciemny motyw domyślny. Fiolet brand (#6d28d9) na CTA i akcentach. Dużo białego znaku — premium bez korporacyjnej zadęcia.",
    });
    console.log("✓ brandVisual (kolory + typografia z syntance.com)");
  }
}

async function seedCopyGuidelines(dryRun: boolean) {
  const [cg] = await db
    .select()
    .from(copyGuidelines)
    .where(eq(copyGuidelines.projectId, PID));
  if (cg) {
    console.log("• copyGuidelines już istnieje — pomijam");
    return;
  }
  if (dryRun) {
    console.log("[dry-run] copyGuidelines → INSERT");
    return;
  }
  await db.insert(copyGuidelines).values({
    projectId: PID,
    principlesMd,
    doMd,
    dontMd,
    templates: copyTemplates,
    examples: copyExamples,
    hashtags: ["#nextjs", "#headless", "#konwersja"],
  });
  console.log("✓ copyGuidelines (+ szablony i przykłady)");
}

async function seedChannels(dryRun: boolean) {
  const n = await rowCount(
    channels,
    and(eq(channels.projectId, PID), isNull(channels.deletedAt))
  );
  if (n > 0) {
    console.log(`• channels już istnieją (${n}) — pomijam`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] channels → INSERT ${channelSeeds.length}`);
    return;
  }
  for (const c of channelSeeds) {
    await db.execute(sql`
      insert into "channels"
        ("workspace_id", "project_id", "name", "type", "icon", "cost_monthly", "description", "status")
      values
        (${WORKSPACE_ID}, ${PID}, ${c.name}, ${c.type}, ${c.icon}, ${c.costMonthly ?? null}, ${c.description}, ${c.status})
    `);
  }
  console.log(`✓ channels (${channelSeeds.length})`);
}

async function seedWebsite(dryRun: boolean) {
  const siteId = await ensurePrimarySite(dryRun);
  if (!siteId) return;

  const pageN = await rowCount(
    pages,
    and(eq(pages.projectId, PID), isNull(pages.deletedAt))
  );
  if (pageN === 0) {
    if (dryRun) {
      console.log(`[dry-run] pages → INSERT ${pageSeeds.length}`);
    } else {
      for (const p of pageSeeds) {
        await db.insert(pages).values({
          projectId: PID,
          siteId,
          name: p.name,
          urlPath: p.urlPath,
          type: p.type,
          status: p.status,
          priority: p.priority,
          cta: p.cta,
          goal: p.goal,
          roleInFunnel: p.roleInFunnel,
        });
      }
      console.log(`✓ pages (${pageSeeds.length}) — struktura syntance.com`);
    }
  } else {
    console.log(`• pages już istnieją (${pageN}) — pomijam`);
  }

  const navN = await rowCount(
    navItems,
    and(eq(navItems.projectId, PID), isNull(navItems.deletedAt))
  );
  if (navN === 0 && !dryRun) {
    for (const n of navSeeds) {
      await db.insert(navItems).values({
        projectId: PID,
        siteId,
        label: n.label,
        url: n.url,
        position: n.position,
        type: "link",
        orderIdx: n.orderIdx,
      });
    }
    console.log(`✓ navItems (${navSeeds.length}) — menu główne`);
  } else if (navN === 0 && dryRun) {
    console.log(`[dry-run] navItems → INSERT ${navSeeds.length}`);
  } else if (navN > 0) {
    console.log(`• navItems już istnieją (${navN}) — pomijam`);
  }

  const techN = await rowCount(
    techStack,
    and(eq(techStack.projectId, PID), isNull(techStack.deletedAt))
  );
  if (techN === 0) {
    if (dryRun) {
      console.log(`[dry-run] techStack → INSERT ${techSeeds.length}`);
    } else {
      for (const t of techSeeds) {
        await db.insert(techStack).values({
          projectId: PID,
          name: t.name,
          category: t.category,
          description: t.description,
          url: t.url,
          status: t.status,
        });
      }
      console.log(`✓ techStack (${techSeeds.length}) — Notion: Stack technologiczny`);
    }
  } else {
    console.log(`• techStack już istnieje (${techN}) — pomijam`);
  }

  const seoN = await rowCount(
    seoKeywords,
    and(eq(seoKeywords.projectId, PID), isNull(seoKeywords.deletedAt))
  );
  if (seoN === 0) {
    if (dryRun) {
      console.log(`[dry-run] seoKeywords → INSERT ${seoSeeds.length}`);
    } else {
      for (const s of seoSeeds) {
        await db.insert(seoKeywords).values({
          projectId: PID,
          siteId,
          phrase: s.phrase,
          intent: s.intent,
          funnelStage: s.funnelStage,
          priority: s.priority,
          status: s.status,
        });
      }
      console.log(`✓ seoKeywords (${seoSeeds.length}) — SEO H1 syntance.com`);
    }
  } else {
    console.log(`• seoKeywords już istnieją (${seoN}) — pomijam`);
  }
}

async function seedFunnel(dryRun: boolean) {
  const stageN = await db
    .select({ c: count() })
    .from(purchaseStages)
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(and(eq(segments.projectId, PID), isNull(purchaseStages.deletedAt)))
    .then((r) => r[0]?.c ?? 0);

  if (stageN > 0) {
    console.log(`• purchaseStages już istnieją (${stageN}) — pomijam lejek`);
    return;
  }

  const b2bSeg = await findSegment("B2B");
  if (!b2bSeg) {
    console.warn("⚠ Brak segmentu B2B Direct — pomijam lejek");
    return;
  }

  if (dryRun) {
    console.log("[dry-run] purchaseStages + funnelElements → INSERT (B2B Direct)");
    return;
  }

  const stageByPhase = new Map<string, string>();
  for (const phase of FUNNEL_PHASES) {
    const [stage] = await db
      .insert(purchaseStages)
      .values({
        segmentId: b2bSeg.id,
        name: phase.name,
        phase: phase.phase,
        orderIdx: phase.orderIdx,
      })
      .returning({ id: purchaseStages.id });
    stageByPhase.set(phase.phase, stage.id);
  }

  let pos = 0;
  for (const el of b2bFunnelElements) {
    const stageId = stageByPhase.get(el.phase);
    if (!stageId) continue;
    await db.insert(funnelElements).values({
      stageId,
      segmentId: b2bSeg.id,
      name: el.name,
      format: el.format,
      cta: el.cta,
      ctaUrl: el.ctaUrl,
      contentMd: el.contentMd,
      status: "active",
      position: pos++,
    });
  }
  console.log(
    `✓ lejek B2B Direct — ${FUNNEL_PHASES.length} etapów, ${b2bFunnelElements.length} elementów`
  );
}

async function seedUserFlows(dryRun: boolean) {
  const flowN = await rowCount(
    userFlows,
    and(eq(userFlows.projectId, PID), isNull(userFlows.deletedAt))
  );
  if (flowN > 0) {
    console.log(`• userFlows już istnieją (${flowN}) — pomijam`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] userFlows → INSERT ${userFlowSeeds.length}`);
    return;
  }

  for (const flow of userFlowSeeds) {
    const seg = await findSegment(flow.segmentPattern);
    await db.insert(userFlows).values({
      projectId: PID,
      segmentId: seg?.id,
      name: flow.name,
      type: flow.type,
      conversionGoal: flow.conversionGoal,
      stepsMd: flow.stepsMd,
      status: flow.status,
    });
  }
  console.log(`✓ userFlows (${userFlowSeeds.length}) — Notion: User Flows`);
}

async function seedSalesCopy(dryRun: boolean) {
  const pitchN = await rowCount(
    salesPitches,
    and(eq(salesPitches.projectId, PID), isNull(salesPitches.deletedAt))
  );
  if (pitchN === 0) {
    if (dryRun) {
      console.log(`[dry-run] salesPitches → INSERT ${pitchSeeds.length}`);
    } else {
      const b2bSeg = await findSegment("B2B");
      for (let i = 0; i < pitchSeeds.length; i++) {
        const p = pitchSeeds[i];
        await db.insert(salesPitches).values({
          projectId: PID,
          segmentId: b2bSeg?.id,
          context: p.context,
          title: p.title,
          pitchMd: p.pitchMd,
          status: p.status,
          orderIdx: i,
        });
      }
      console.log(`✓ salesPitches (${pitchSeeds.length})`);
    }
  } else {
    console.log(`• salesPitches już istnieją (${pitchN}) — pomijam`);
  }

  const scriptN = await rowCount(
    salesScripts,
    and(eq(salesScripts.projectId, PID), isNull(salesScripts.deletedAt))
  );
  if (scriptN === 0) {
    if (dryRun) {
      console.log(`[dry-run] salesScripts → INSERT ${scriptSeeds.length}`);
    } else {
      for (let i = 0; i < scriptSeeds.length; i++) {
        const s = scriptSeeds[i];
        await db.insert(salesScripts).values({
          projectId: PID,
          context: s.context,
          name: s.name,
          scriptMd: s.scriptMd,
          status: s.status,
          orderIdx: i,
        });
      }
      console.log(`✓ salesScripts (${scriptSeeds.length})`);
    }
  } else {
    console.log(`• salesScripts już istnieją (${scriptN}) — pomijam`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("=== DRY RUN ===\n");

  console.log(`Seed Syntance z Notion → projekt ${PID}\n`);

  await seedProjectMeta(dryRun);
  await seedBrand(dryRun);
  await seedCopyGuidelines(dryRun);
  await seedChannels(dryRun);
  await seedWebsite(dryRun);
  await seedFunnel(dryRun);
  await seedUserFlows(dryRun);
  await seedSalesCopy(dryRun);

  console.log("\nGotowe.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
