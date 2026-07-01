"use client";

import * as React from "react";

export interface ProjectAlert {
  id: string;
  kind: "kpi" | "domain" | "sync" | "visit";
  severity: "warning" | "critical";
  title: string;
  message: string;
}

/**
 * Jedno źródło alertów projektu przez SSE (Faza 15, M4) — zamiast osobnych
 * pollerów w `AlertsToaster` (dawniej 60s) i `AlertsBell` (dawniej 5min).
 * `EventSource` sam reconnectuje po zerwaniu połączenia (spec przeglądarkowy).
 */
export function useProjectAlerts(
  projectId: string | null | undefined
): ProjectAlert[] {
  const [alerts, setAlerts] = React.useState<ProjectAlert[]>([]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset przy zmianie/braku projectId
    setAlerts([]);
    if (!projectId) {
      return;
    }

    const es = new EventSource(
      `/api/strategy-hub/projects/${projectId}/alerts/stream`
    );

    es.addEventListener("alerts", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          alerts: ProjectAlert[];
        };
        setAlerts(data.alerts ?? []);
      } catch {
        // ignoruj malformed event
      }
    });

    es.onerror = () => {
      // EventSource reconnectuje automatycznie; nic nie robimy.
    };

    return () => es.close();
  }, [projectId]);

  return alerts;
}
