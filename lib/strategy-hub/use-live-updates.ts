"use client";

import { useEffect, useRef } from "react";

/**
 * Nasłuchuje SSE `/api/strategy-hub/projects/[id]/live` i wywołuje `onChange`
 * za każdym razem, gdy serwer wykryje nowy wpis w `change_history` projektu
 * (propagacja < 5s, zgodnie ze spec). Bez `projectId` — no-op.
 */
export function useProjectLiveUpdates(
  projectId: string | null | undefined,
  onChange: (info: { at: string; entityType?: string }) => void
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;

    const es = new EventSource(`/api/strategy-hub/projects/${projectId}/live`);
    es.addEventListener("changed", (ev: MessageEvent) => {
      try {
        onChangeRef.current(JSON.parse(ev.data));
      } catch {
        onChangeRef.current({ at: new Date().toISOString() });
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; nic nie robimy — kolejny "ready" naprawi stan.
    };

    return () => es.close();
  }, [projectId]);
}

/** Wariant dla dashboardu klienta — `/api/projects/[slug]/live` (sesja klienta). */
export function useClientPortalLiveUpdates(
  slug: string | null | undefined,
  onChange: (info: { at: string }) => void
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!slug) return;

    const es = new EventSource(`/api/projects/${slug}/live`);
    es.addEventListener("changed", (ev: MessageEvent) => {
      try {
        onChangeRef.current(JSON.parse(ev.data));
      } catch {
        onChangeRef.current({ at: new Date().toISOString() });
      }
    });
    es.onerror = () => {};

    return () => es.close();
  }, [slug]);
}
