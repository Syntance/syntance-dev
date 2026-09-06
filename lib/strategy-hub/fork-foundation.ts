import "server-only";
import { db } from "@/db";
import {
  projects,
  businessProblems,
  uvp,
  brandPositioning,
  competitors,
  brandIdentity,
  brandVisual,
  copyGuidelines,
  offers,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

/**
 * Odłączenie fundamentu: kopiuje encje W0 z projektu-źródła do projektu
 * i przełącza go na `strategy_mode = 'wlasna'`.
 *
 * DLACZEGO KOPIA, A NIE SAMO PRZEŁĄCZENIE: dziedziczenie jest read-through —
 * projekt `dziedziczona` nie ma własnych wierszy fundamentu. Samo ustawienie
 * `wlasna` zostawiłoby go z pustym fundamentem, co użytkownik zobaczyłby jako
 * utratę danych. Odłączenie musi więc najpierw zmaterializować to, co widział.
 *
 * Kolumny czyszczone przy kopiowaniu:
 *  - `id` / `createdAt` / `updatedAt` — nadaje je baza,
 *  - `pathId` — ścieżki należą do projektu źródłowego i poza niego nie wychodzą,
 *  - `segmentId` (konkurenci) — segmenty są lokalne dla projektu, wskaźnik
 *    prowadziłby do cudzego wiersza.
 */

const POMIJANE = new Set([
  "id",
  "projectId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "pathId",
  "segmentId",
]);

function oczysc<T extends Record<string, unknown>>(
  wiersz: T,
  projectId: string
): Record<string, unknown> {
  const wynik: Record<string, unknown> = { projectId };
  for (const [klucz, wartosc] of Object.entries(wiersz)) {
    if (POMIJANE.has(klucz)) continue;
    wynik[klucz] = wartosc;
  }
  return wynik;
}

export interface ForkResult {
  /** Czy cokolwiek skopiowano (false = projekt i tak miał własny fundament). */
  skopiowano: boolean;
  zrodloProjectId: string | null;
  liczbaWierszy: number;
}

export async function forkFoundation(projectId: string): Promise<ForkResult> {
  const zrodlo = await resolveFoundationSource(projectId);

  // Projekt już jest samodzielny albo łańcuch był zerwany — nie ma czego kopiować,
  // wystarczy upewnić się, że tryb jest spójny z rzeczywistością.
  if (!zrodlo.inherited || zrodlo.projectId === projectId) {
    await db
      .update(projects)
      .set({ strategyMode: "wlasna", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    return { skopiowano: false, zrodloProjectId: null, liczbaWierszy: 0 };
  }

  const src = zrodlo.projectId;
  let liczbaWierszy = 0;

  // ── Listy ────────────────────────────────────────────────────────────────
  const listy = [
    { tabela: businessProblems, kolumna: businessProblems.projectId, usuniete: businessProblems.deletedAt },
    { tabela: competitors, kolumna: competitors.projectId, usuniete: competitors.deletedAt },
    { tabela: offers, kolumna: offers.projectId, usuniete: offers.deletedAt },
  ] as const;

  for (const { tabela, kolumna, usuniete } of listy) {
    const wiersze = await db
      .select()
      .from(tabela)
      .where(and(eq(kolumna, src), isNull(usuniete)));
    if (wiersze.length === 0) continue;
    await db
      .insert(tabela)
      .values(
        wiersze.map((w) => oczysc(w as Record<string, unknown>, projectId)) as never
      );
    liczbaWierszy += wiersze.length;
  }

  // ── Singletony (jeden wiersz per projekt, klucz główny = projectId) ──────
  const singletony = [
    { tabela: uvp, kolumna: uvp.projectId },
    { tabela: brandPositioning, kolumna: brandPositioning.projectId },
    { tabela: brandIdentity, kolumna: brandIdentity.projectId },
    { tabela: brandVisual, kolumna: brandVisual.projectId },
    { tabela: copyGuidelines, kolumna: copyGuidelines.projectId },
  ] as const;

  for (const { tabela, kolumna } of singletony) {
    const [wiersz] = await db.select().from(tabela).where(eq(kolumna, src)).limit(1);
    if (!wiersz) continue;
    await db
      .insert(tabela)
      .values(oczysc(wiersz as Record<string, unknown>, projectId) as never)
      .onConflictDoNothing();
    liczbaWierszy += 1;
  }

  await db
    .update(projects)
    .set({ strategyMode: "wlasna", updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return { skopiowano: true, zrodloProjectId: src, liczbaWierszy };
}
