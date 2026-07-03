/**
 * Uzupełnia dane firmy Syntance w aplikacji na podstawie workspace Syntance w Notion.
 * Wypełnia luki (puste tabele), nie nadpisuje istniejących danych relacyjnych
 * (problemy, obiekcje, segmenty, KPI, pozycjonowanie, UVP zostają nietknięte).
 *
 * Źródła Notion:
 *  - „Główne informacje - Syntance" (tożsamość, misja, wizja, filary, ToV)
 *  - „Pozycjonowanie Syntance 2025–2026" (ToV TAK/NIE, słowa-klucze/tabu, USP)
 *  - „Plan operacyjny marketingu — H1 2026" (kanały: silnik cashflow + brand + zamrożone)
 *
 * Uruchomienie: pnpm tsx scripts/seed-syntance-company.ts
 */
import "dotenv/config";
import { db } from "@/db";
import { brandIdentity, copyGuidelines, channels } from "@/db/schema";
import { eq, isNull, and, count, sql } from "drizzle-orm";

const PID = "c9572f7f-feb5-42f6-b5d6-1b489fd66488";
// Tabela channels w bazie ma workspace_id NOT NULL (poza schematem Drizzle).
const WORKSPACE_ID = "02354552-3b71-4080-95a5-3cf9e2e946f1";

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
- **„My w Syntance”, nie „ja”** — firma na pierwszym planie, founder w służbie marki. „Syntance robi”, „w Syntance projektujemy” — nie „ja zrobię”, „Kamil wdroży”.
- **Konkret zamiast korpomowy** — „+47% konwersji w 3 miesiące” zamiast „wysokiej jakości rozwiązania”. Liczby, nie przymiotniki.
- **Kontrast jako narzędzie sprzedaży** — „nie tani WP, nie drogie enterprise — trzecia droga”. Pokazujemy gdzie jesteśmy, mówiąc czym NIE jesteśmy.
- **Bezpośredniość, nie korporacja** — „Twoja strona nie sprzedaje” zamiast „Pomagamy poprawić Państwa wyniki”. „Ty”, nie „Państwo”.
- **Krótkie zdania, dużo białego znaku** — przestrzeń = jakość. Zero ścian tekstu.
- **Zero marketingowego żargonu** — bez „synergii”, „rewolucji”, „innowacji” bez konkretu.

**Forma:** „Ty” dla młodszego biznesu i marek D2C; „Państwo” zostawiamy korporacjom. Emoji punktowo — w callout’ach i listach, nie w treści ciągłej.

**Przykład tonu:** „Syntance projektuje sklepy Next.js, które konwertują 2× lepiej niż na Shopify — bez narzutu agencyjnego.”

**Słowa-klucze:** butikowe studio, partner technologiczny, strategy-first, headless, konwersja, lejek, mierzalne, founder-led, rozszerzony zespół.

**Słowa-tabu:** „leciutko”, „lekko”, „ładnie”, „fajnie”, „freelancer”, „jednoosobowa firma”, „rewolucja”, „innowacja” (bez konkretu).`;

const brandPersonalityMd = `**Founder-led brand** — Kamil jest „głosem Syntance”, twarzą studia, ale klient kupuje **Syntance**, nie „Kamila Podobińskiego”. Marka skaluje się niezależnie od osoby.

**3 zasady:**
1. Firma na pierwszym planie, twarz w służbie marki.
2. „My w Syntance” zamiast „ja” — w treściach, ofertach, case studies, mailach, na LinkedIn.
3. Rozszerzony zespół zamiast solo — copywriter, prawnik B2B, designer, analityk = stała sieć kontraktorów Syntance.

**Czego unikamy:** „Kamil Podobiński Studio” / „podobinski.dev” (zamyka skalowanie), fake’owego „zespołu”, którego nie ma, treści „mój dzień / mindset / biegam o 5” (to buduje Kamila, nie Syntance).`;

const principlesMd = `Zasady komunikacji obowiązują we WSZYSTKICH kanałach (strona, LinkedIn, blog, email, eventy, outbound).

- Pozycjonujemy **firmę, nie osobę** — „My w Syntance”, nie „ja”.
- **Konkret i liczby** zamiast przymiotników — „+47% konwersji”, „PageSpeed 96+”, „4–8 tyg.”.
- **Kontrast** jako narzędzie — „nie tani WP, nie drogie enterprise — trzecia droga”.
- **Bezpośredniość** — „Ty”, krótkie zdania, dużo białego znaku.
- Każdy komunikat dowodzi jednej z przewag: strategy-first, mierzalność, headless/Next.js, EAA w standardzie, founder-led.`;

const doMd = `- „My w Syntance”, „Syntance robi”
- „+47% konwersji w 3 miesiące” (konkret, liczba)
- „Nie tani WP, nie drogie enterprise — trzecia droga” (kontrast)
- „Twoja strona nie sprzedaje” (bezpośredniość)
- „Sklep w 4–8 tyg., nie w 6 miesięcy” (ekspertyza bez korpomowy)
- „Ty” (młodszy biznes, marki D2C)
- Emoji punktowo, w callout’ach i listach`;

const dontMd = `- „Ja”, „Kamil zrobi”
- „Wysokiej jakości rozwiązania” (ogólnik bez liczby)
- „Najlepsi na rynku” (pusty superlatyw)
- „Pomagamy poprawić Państwa wyniki” (korpomowa)
- „Implementujemy rozwiązania omnichannel” (żargon)
- „Państwo” (zostawiamy korporacjom)
- Emoji w treści ciągłej, w nadmiarze
- Słowa-tabu: „leciutko”, „lekko”, „ładnie”, „fajnie”, „freelancer”, „jednoosobowa firma”, „rewolucja”, „innowacja” (bez konkretu)`;

interface ChannelSeed {
  name: string;
  type: string;
  icon: string;
  description: string;
  status: "active" | "planned";
  costMonthly?: number;
}

const channelSeeds: ChannelSeed[] = [
  // ── Silnik cashflow (60% energii, horyzont 30–60 dni) ──
  {
    name: "Siatka kontaktów / polecenia",
    type: "referral",
    icon: "🤝",
    status: "active",
    description:
      "Główny silnik cashflow H1 2026. DM-y do ~20 osób + follow-up po 3 dniach, z floor 5k / 10k / 20k w treści. Cel: pierwsza faktura ≥5k w 14 dni.",
  },
  {
    name: "LinkedIn outbound",
    type: "outbound",
    icon: "💼",
    status: "active",
    description:
      "10 wiadomości/dzień do CEO B2B 10–49 osób ze słabym PageSpeed (<50). Język: rezultat + szybkość + własność kodu.",
  },
  {
    name: "LinkedIn organic",
    type: "social",
    icon: "📣",
    status: "active",
    description:
      "Silnik brand: 2 posty/tydzień z konkretem (case study, technical breakdown). Zero „otwieram sloty”. Cel: 2–3 leady inbound/mc do Q3.",
  },
  {
    name: "Upwork (wycelowany)",
    type: "marketplace",
    icon: "🌐",
    status: "active",
    description:
      "Tylko Next.js / Sanity / Medusa / headless. Min. $1500 fixed lub $50/h. Pomijamy WordPress fix, Shopify theme, Webflow build.",
  },
  {
    name: "Case studies (syntance.com)",
    type: "content",
    icon: "📄",
    status: "active",
    description:
      "Dowód społeczny na stronie — RetroHouse + Lumine do końca czerwca 2026 (1 strona + 3 screeny + 3 liczby każdy).",
  },
  {
    name: "SEO syntance.com",
    type: "SEO",
    icon: "🔍",
    status: "active",
    description:
      "H1: tylko `/`, `/cennik`, `/strony-www` (reszta zamrożona). KPI kwartalne: pozycje na 3 frazach.",
  },
  // ── Zamrożone do Q4 2026 (referencja, nie wykonujemy w H1) ──
  {
    name: "Blog SEO",
    type: "content",
    icon: "📝",
    status: "planned",
    description: "4 art. kliniki + 5 art. meble. Zamrożone do Q4 2026.",
  },
  {
    name: "Google Ads",
    type: "ads",
    icon: "🎯",
    status: "planned",
    costMonthly: 2500,
    description:
      "Budżet 2–3k/mc bez pierwszego klienta = strata. Uruchamiamy po stabilnym cashflow.",
  },
  {
    name: "Targi i eventy",
    type: "event",
    icon: "🎪",
    status: "planned",
    description:
      "Meble Polska, DREMA, Warsaw Home, I❤️Marketing, SEMcamp. Zamrożone do Q4 2026.",
  },
  {
    name: "Partnerstwa ERP",
    type: "partnership",
    icon: "🔗",
    status: "planned",
    description: "InsERT, Comarch, BaseLinker. Inicjatywa długoterminowa — Q4 2026.",
  },
  {
    name: "Lead magnety",
    type: "content",
    icon: "🧲",
    status: "planned",
    description:
      "Kalkulatory marży, raporty PDF, checklisty. Zamrożone do Q4 2026.",
  },
  {
    name: "Cold outbound do agencji (White-Label)",
    type: "outbound",
    icon: "📨",
    status: "planned",
    description:
      "Track A White-Label (Ania). Aktywny outbound zamrożony — tylko inbound (cykl 60–120 dni zbyt długi pod cashflow).",
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1) brandIdentity (singleton) — wypełnij, jeśli puste.
  const [bi] = await db
    .select()
    .from(brandIdentity)
    .where(eq(brandIdentity.projectId, PID));
  if (bi) {
    console.log("• brandIdentity już istnieje — pomijam (bez nadpisywania).");
  } else if (!dryRun) {
    await db.insert(brandIdentity).values({
      projectId: PID,
      missionMd,
      visionMd,
      purposeMd,
      brandPillarsMd,
      toneOfVoiceMd,
      brandPersonalityMd,
    });
    console.log("✓ brandIdentity uzupełnione (misja, wizja, cel, filary, ToV, osobowość).");
  } else {
    console.log("[dry-run] brandIdentity → INSERT");
  }

  // 2) copyGuidelines (singleton) — wypełnij, jeśli puste.
  const [cg] = await db
    .select()
    .from(copyGuidelines)
    .where(eq(copyGuidelines.projectId, PID));
  if (cg) {
    console.log("• copyGuidelines już istnieje — pomijam.");
  } else if (!dryRun) {
    await db.insert(copyGuidelines).values({
      projectId: PID,
      principlesMd,
      doMd,
      dontMd,
    });
    console.log("✓ copyGuidelines uzupełnione (zasady + TAK/NIE).");
  } else {
    console.log("[dry-run] copyGuidelines → INSERT");
  }

  // 3) channels — dodaj tylko gdy brak aktywnych kanałów (idempotencja).
  const [chCount] = await db
    .select({ c: count() })
    .from(channels)
    .where(and(eq(channels.projectId, PID), isNull(channels.deletedAt)));
  if ((chCount?.c ?? 0) > 0) {
    console.log(`• channels już istnieją (${chCount?.c}) — pomijam seed kanałów.`);
  } else if (!dryRun) {
    // Raw SQL — tabela channels ma workspace_id NOT NULL (poza schematem Drizzle).
    for (const c of channelSeeds) {
      await db.execute(sql`
        insert into "channels"
          ("workspace_id", "project_id", "name", "type", "icon", "cost_monthly", "description", "status")
        values
          (${WORKSPACE_ID}, ${PID}, ${c.name}, ${c.type}, ${c.icon}, ${c.costMonthly ?? null}, ${c.description}, ${c.status})
      `);
    }
    console.log(`✓ channels uzupełnione (${channelSeeds.length} kanałów).`);
  } else {
    console.log(`[dry-run] channels → INSERT ${channelSeeds.length} wierszy`);
  }

  console.log("\nGotowe.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
