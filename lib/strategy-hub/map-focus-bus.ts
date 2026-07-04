export type MapFocusMode = "focus" | "highlight" | "path";

export interface MapFocusDetail {
  entityType: string;
  entityId: string;
  mode: MapFocusMode;
  pathIds?: string[];
}

const EVENT_NAME = "hub:map-focus";

let listenerCount = 0;

export function emitMapFocus(detail: MapFocusDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MapFocusDetail>(EVENT_NAME, { detail }));
}

export function onMapFocus(cb: (detail: MapFocusDetail) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  listenerCount += 1;
  const handler = (event: Event) => {
    cb((event as CustomEvent<MapFocusDetail>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    listenerCount = Math.max(0, listenerCount - 1);
  };
}

/** Czy widok mapy (np. konstelacja) nasłuchuje na fokus — do fallbacku linku w czacie. */
export function hasMapFocusListener(): boolean {
  return listenerCount > 0;
}

export function mapFocusNodeId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function mapFocusHref(
  projectId: string,
  entityType: string,
  entityId: string
): string {
  const focus = encodeURIComponent(`${entityType}:${entityId}`);
  return `/strategy-hub/projects/${projectId}/constellation?focus=${focus}`;
}
