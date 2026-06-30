"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  body: string;
  authorType: string | null;
  authorName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface EntityCommentsProps {
  projectId: string;
  entityType: string;
  entityId: string;
  readOnly?: boolean;
  className?: string;
}

export function EntityComments({
  projectId,
  entityType,
  entityId,
  readOnly = false,
  className,
}: EntityCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/comments?${params}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: Comment[] };
      setComments(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId, body: body.trim() }),
        }
      );
      if (res.ok) {
        setBody("");
        await load();
      }
    });
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card/40 p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="size-4 text-muted-foreground" />
        Komentarze ({comments.length})
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak komentarzy.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn(
                "rounded-lg border border-border/60 px-3 py-2 text-xs",
                c.resolvedAt && "opacity-60"
              )}
            >
              <div className="flex justify-between gap-2 text-muted-foreground mb-1">
                <span>{c.authorName ?? c.authorType ?? "team"}</span>
                <time dateTime={c.createdAt}>
                  {new Date(c.createdAt).toLocaleString("pl-PL")}
                </time>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Dodaj komentarz… (@kamil, @klient)"
            rows={2}
            className="text-sm min-h-0"
            aria-label="Treść komentarza"
          />
          <Button
            type="button"
            size="icon"
            disabled={pending || !body.trim()}
            onClick={() => submit()}
            aria-label="Wyślij komentarz"
          >
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
