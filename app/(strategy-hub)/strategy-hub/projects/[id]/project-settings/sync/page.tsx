import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { projects, notionSyncLog } from "@/db/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Sync Notion" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectSyncPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  const [last] = await db
    .select({
      direction: notionSyncLog.direction,
      status: notionSyncLog.status,
      syncedAt: notionSyncLog.syncedAt,
      error: notionSyncLog.error,
    })
    .from(notionSyncLog)
    .where(eq(notionSyncLog.projectId, id))
    .orderBy(desc(notionSyncLog.syncedAt))
    .limit(1);

  const row = await db
    .select({ notionPageUrl: projects.notionPageUrl })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const notionPageUrl = row[0]?.notionPageUrl;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Synchronizacja z Notion</h2>
        </div>

        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Strona Notion</span>
            {notionPageUrl ? (
              <a
                href={notionPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand hover:underline truncate max-w-[60%]"
              >
                Połączono
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <Badge variant="secondary">Brak powiązania</Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ostatni sync</span>
            {last ? (
              <span className="tabular-nums">
                {last.syncedAt?.toLocaleString("pl-PL") ?? "—"}
                {" · "}
                <Badge variant="outline" className="text-[10px] h-5">
                  {last.status ?? "—"}
                </Badge>
              </span>
            ) : (
              <span className="text-muted-foreground">Brak historii</span>
            )}
          </div>

          {last?.error && (
            <p className="text-xs text-destructive rounded-md bg-destructive/10 p-2">
              {last.error}
            </p>
          )}
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href="/strategy-hub/sync">
            Otwórz panel sync (wszystkie projekty)
          </Link>
        </Button>
      </div>
    </div>
  );
}
