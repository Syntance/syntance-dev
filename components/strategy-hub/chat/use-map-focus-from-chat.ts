"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@ai-sdk/react";
import {
  emitMapFocus,
  type MapFocusDetail,
  type MapFocusMode,
} from "@/lib/strategy-hub/map-focus-bus";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFocusArgs(args: unknown): MapFocusDetail | null {
  if (!isRecord(args)) return null;
  const entityType = args.entityType;
  const entityId = args.entityId;
  const mode = args.mode;
  if (typeof entityType !== "string" || typeof entityId !== "string") return null;
  const focusMode: MapFocusMode =
    mode === "highlight" || mode === "path" || mode === "thread"
      ? mode
      : "focus";
  const pathIds = Array.isArray(args.pathIds)
    ? args.pathIds.filter((id): id is string => typeof id === "string")
    : undefined;
  return { entityType, entityId, mode: focusMode, pathIds };
}

function focusKey(detail: MapFocusDetail): string {
  return `${detail.entityType}:${detail.entityId}:${detail.mode}:${detail.pathIds?.join(",") ?? ""}`;
}

/** Emituje fokus mapy gdy AI wywoła focus_map_node. */
export function useMapFocusFromChat(messages: Message[]): void {
  const handled = useRef(new Set<string>());

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const parts = (msg as { parts?: unknown[] }).parts;
      if (!Array.isArray(parts)) continue;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!isRecord(part) || part.type !== "tool-invocation") continue;
        if (part.toolName !== "focus_map_node") continue;
        if (part.state !== "result") continue;

        const detail = parseFocusArgs(part.args);
        if (!detail) continue;

        const key = `${msg.id ?? "m"}-${i}-${focusKey(detail)}`;
        if (handled.current.has(key)) continue;
        handled.current.add(key);

        if (part.state === "result") {
          emitMapFocus(detail);
        }
      }
    }
  }, [messages]);
}

export { parseFocusArgs };
