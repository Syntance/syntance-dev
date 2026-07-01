import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects, brandIdentity, brandVisual } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { Palette, Hammer, Compass, Eye, Layers, Mic2 } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

interface ColorItem {
  name: string;
  hex?: string;
  value?: string;
  role?: string;
}

async function getBrand(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  identity: typeof brandIdentity.$inferSelect | null;
  visual: typeof brandVisual.$inferSelect | null;
}> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);

    if (!rows[0]) return { moduleVis: "visible", identity: null, visual: null };

    const projectId = rows[0].id;
    trackVisit(projectId, "brand");

    const [identityRows, visualRows, vis] = await Promise.all([
      db.select().from(brandIdentity).where(eq(brandIdentity.projectId, projectId)).limit(1),
      db.select().from(brandVisual).where(eq(brandVisual.projectId, projectId)).limit(1),
      getProjectVisibility(projectId),
    ]);

    return {
      moduleVis: moduleStatus(vis, "brand"),
      identity: identityRows[0] ?? null,
      visual: visualRows[0] ?? null,
    };
  } catch {
    return { moduleVis: "visible", identity: null, visual: null };
  }
}

const IDENTITY_SECTIONS = [
  { key: "missionMd" as const, label: "Misja", icon: Compass },
  { key: "visionMd" as const, label: "Wizja", icon: Eye },
  { key: "brandPillarsMd" as const, label: "Filary marki", icon: Layers },
  { key: "toneOfVoiceMd" as const, label: "Tone of Voice", icon: Mic2 },
];

export default async function ClientBrandPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }
  if (!project) notFound();

  const { moduleVis, identity, visual } = await getBrand(slug);
  if (moduleVis === "hidden") notFound();

  const colors = (visual?.colors as ColorItem[] | null) ?? [];
  const hasIdentity = identity && IDENTITY_SECTIONS.some((s) => identity[s.key]);
  const hasVisual = visual && (colors.length > 0 || visual.brandbookUrl);
  const hasContent = hasIdentity || hasVisual;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Palette className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Marka</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tożsamość i identyfikacja wizualna Twojej marki.
        </p>
      </div>

      {moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
        </div>
      ) : !hasContent ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Palette className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Tożsamość marki jest jeszcze opracowywana.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {identity &&
            IDENTITY_SECTIONS.filter((s) => identity[s.key]).map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className="size-4 text-brand" />
                  <h2 className="font-medium text-sm">{s.label}</h2>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {identity[s.key]}
                </p>
              </div>
            ))}

          {hasVisual && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="size-4 text-brand" />
                <h2 className="font-medium text-sm">Identyfikacja wizualna</h2>
              </div>
              {colors.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {colors.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div
                        className="size-10 rounded-lg border border-border/60 shadow-sm"
                        style={{ backgroundColor: c.hex ?? c.value ?? "#ccc" }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {c.role ?? c.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {visual?.brandbookUrl && (
                <a
                  href={visual.brandbookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  Pobierz brandbook →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
