"use client";

import { EntityComments } from "@/components/strategy-hub/entity-comments";
import { LastUpdateBadge } from "@/components/strategy-hub/last-update-badge";
import { VersionTimeline } from "@/components/strategy-hub/version-timeline";

interface EntityMetaPanelProps {
  projectId: string;
  entityType: string;
  entityId: string;
  readOnly?: boolean;
}

/** Komentarze + badge + timeline per encja (Faza 6). */
export function EntityMetaPanel({
  projectId,
  entityType,
  entityId,
  readOnly = false,
}: EntityMetaPanelProps) {
  return (
    <div className="space-y-3 border-t border-border pt-4 mt-4">
      <LastUpdateBadge
        projectId={projectId}
        entityType={entityType}
        entityId={entityId}
      />
      <EntityComments
        projectId={projectId}
        entityType={entityType}
        entityId={entityId}
        readOnly={readOnly}
      />
      <VersionTimeline
        projectId={projectId}
        entityType={entityType}
        entityId={entityId}
        readOnly={readOnly}
      />
    </div>
  );
}
