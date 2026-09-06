import "server-only";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Zakres strategii: skąd projekt czyta fundament (W0).
 *
 * Dwie osie, celowo prostopadłe i nie do pomylenia:
 *  - ORGANIZACYJNA (ten plik): projekt `dziedziczona` czyta fundament od
 *    najbliższego przodka w drzewie organizacji o trybie `wlasna`.
 *  - WARIANTOWA (`strategyPaths`): ścieżki dzielą strategię WEWNĄTRZ jednego
 *    projektu i nigdy poza niego nie wychodzą.
 *
 * Dziedziczenie jest read-through, nie kopiowaniem: encji nie duplikujemy,
 * tylko czytamy je z projektu-źródła. Dzięki temu żaden silnik (health score,
 * graf relacji, embeddingi) nie musi robić UNION-ów — dostaje po prostu inne
 * `projectId` dla modułów fundamentu.
 */

/** Maksymalna głębokość wspinaczki po drzewie — bezpiecznik na cykle. */
const MAX_DEPTH = 10;

/**
 * Moduły fundamentu (W0), które podlegają dziedziczeniu.
 * Wszystko poza tą listą (rynek, podróż, lejek, kanały, strony, KPI, delivery)
 * jest ZAWSZE lokalne dla projektu.
 */
export const FOUNDATION_ENTITY_KEYS = [
  "problems",
  "uvp",
  "positioning",
  "competitors",
  "brandIdentity",
  "brandVisual",
  "copyGuidelines",
  "offers",
] as const;

export type FoundationEntityKey = (typeof FOUNDATION_ENTITY_KEYS)[number];

export function isFoundationEntity(key: string): key is FoundationEntityKey {
  return (FOUNDATION_ENTITY_KEYS as readonly string[]).includes(key);
}

/**
 * Klucze używane w URL-ach API i w rejestrze encji (kebab-case) → klucz
 * fundamentu. Bez tego mapowania generyczny route `[entity]` nie rozpozna
 * `brand-identity` jako encji W0.
 */
const KLUCZ_ROUTE_NA_FUNDAMENT: Record<string, FoundationEntityKey> = {
  problems: "problems",
  uvp: "uvp",
  positioning: "positioning",
  competitors: "competitors",
  offers: "offers",
  "brand-identity": "brandIdentity",
  "brand-visual": "brandVisual",
  "copy-guidelines": "copyGuidelines",
};

/** Klucz fundamentu dla segmentu URL-a, albo `null` gdy encja nie jest z W0. */
export function foundationKeyForRoute(entity: string): FoundationEntityKey | null {
  if (isFoundationEntity(entity)) return entity;
  return KLUCZ_ROUTE_NA_FUNDAMENT[entity] ?? null;
}

export interface FoundationSource {
  /** Projekt, z którego należy czytać encje fundamentu. */
  projectId: string;
  /** Czy fundament pochodzi z innego projektu niż pytany. */
  inherited: boolean;
  /** Nazwa projektu-źródła — do plakietki „dziedziczone z…" w UI. */
  sourceName: string | null;
  /**
   * Ustawione, gdy łańcuch dziedziczenia jest zerwany (rodzic usunięty albo
   * `dziedziczona` bez rodzica). Fundament czytamy wtedy lokalnie, a UI ma
   * powód, żeby to pokazać zamiast milczeć.
   */
  brokenChain?: "brak-rodzica" | "cykl" | "za-gleboko";
}

/**
 * Wskazuje projekt, z którego czytamy fundament dla `projectId`.
 * Projekt w trybie `wlasna` jest swoim własnym źródłem.
 */
export async function resolveFoundationSource(
  projectId: string
): Promise<FoundationSource> {
  const odwiedzone = new Set<string>([projectId]);

  const [start] = await db
    .select({
      id: projects.id,
      name: projects.name,
      parentProjectId: projects.parentProjectId,
      strategyMode: projects.strategyMode,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  if (!start) {
    return { projectId, inherited: false, sourceName: null };
  }

  let biezacy = start;

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (biezacy.strategyMode !== "dziedziczona") {
      const inherited = biezacy.id !== projectId;
      return {
        projectId: biezacy.id,
        inherited,
        sourceName: inherited ? biezacy.name : null,
      };
    }

    if (!biezacy.parentProjectId) {
      return {
        projectId,
        inherited: false,
        sourceName: null,
        brokenChain: "brak-rodzica",
      };
    }

    if (odwiedzone.has(biezacy.parentProjectId)) {
      return { projectId, inherited: false, sourceName: null, brokenChain: "cykl" };
    }
    odwiedzone.add(biezacy.parentProjectId);

    const [rodzic] = await db
      .select({
        id: projects.id,
        name: projects.name,
        parentProjectId: projects.parentProjectId,
        strategyMode: projects.strategyMode,
      })
      .from(projects)
      .where(
        and(eq(projects.id, biezacy.parentProjectId), isNull(projects.deletedAt))
      )
      .limit(1);

    if (!rodzic) {
      return {
        projectId,
        inherited: false,
        sourceName: null,
        brokenChain: "brak-rodzica",
      };
    }

    biezacy = rodzic;
  }

  return { projectId, inherited: false, sourceName: null, brokenChain: "za-gleboko" };
}

/**
 * Skrót dla warstwy danych: identyfikator projektu, z którego czytać encję
 * o danym kluczu. Encje spoza fundamentu zawsze zwracają własny projekt.
 */
export async function resolveProjectIdForEntity(
  projectId: string,
  entityKey: string
): Promise<string> {
  if (!foundationKeyForRoute(entityKey)) return projectId;
  const source = await resolveFoundationSource(projectId);
  return source.projectId;
}

export interface ProjectTreeNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  kind: string;
  strategyMode: string;
  status: string;
  domain: string | null;
  clientName: string | null;
  updatedAt: Date;
  parentProjectId: string | null;
  children: ProjectTreeNode[];
}

/**
 * Drzewo projektów organizacji (firma → gałąź → produkt).
 * Węzły, których rodzic nie należy do tej organizacji albo tworzyłby cykl,
 * lądują na najwyższym poziomie — widok organizacji nigdy nie gubi projektu.
 */
export async function getProjectTree(
  organizationId: string
): Promise<ProjectTreeNode[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      icon: projects.icon,
      kind: projects.kind,
      strategyMode: projects.strategyMode,
      status: projects.status,
      domain: projects.domain,
      clientName: projects.clientName,
      updatedAt: projects.updatedAt,
      parentProjectId: projects.parentProjectId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        isNull(projects.deletedAt)
      )
    );

  const wezly = new Map<string, ProjectTreeNode>();
  for (const r of rows) wezly.set(r.id, { ...r, children: [] });

  const korzenie: ProjectTreeNode[] = [];
  for (const wezel of wezly.values()) {
    const rodzic = wezel.parentProjectId
      ? wezly.get(wezel.parentProjectId)
      : undefined;

    if (!rodzic || rodzic.id === wezel.id || tworzyCykl(wezel, rodzic, wezly)) {
      korzenie.push(wezel);
      continue;
    }
    rodzic.children.push(wezel);
  }

  const kolejnosc: Record<string, number> = { firma: 0, galaz: 1, produkt: 2 };
  const sortuj = (lista: ProjectTreeNode[]) => {
    lista.sort(
      (a, b) =>
        (kolejnosc[a.kind] ?? 9) - (kolejnosc[b.kind] ?? 9) ||
        a.name.localeCompare(b.name, "pl")
    );
    lista.forEach((w) => sortuj(w.children));
  };
  sortuj(korzenie);

  return korzenie;
}

function tworzyCykl(
  wezel: ProjectTreeNode,
  rodzic: ProjectTreeNode,
  wezly: Map<string, ProjectTreeNode>
): boolean {
  let biezacy: ProjectTreeNode | undefined = rodzic;
  for (let i = 0; i < MAX_DEPTH && biezacy; i += 1) {
    if (biezacy.id === wezel.id) return true;
    biezacy = biezacy.parentProjectId
      ? wezly.get(biezacy.parentProjectId)
      : undefined;
  }
  return false;
}
