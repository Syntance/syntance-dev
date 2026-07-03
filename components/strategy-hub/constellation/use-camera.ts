"use client";

import { useCallback, useRef } from "react";
import {
  useMotionValue,
  useSpring,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";

export interface UseCameraResult {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  transform: MotionValue<string>;
  panStart: (clientX: number, clientY: number) => void;
  panMove: (clientX: number, clientY: number) => void;
  panEnd: () => void;
  zoomAt: (clientX: number, clientY: number, delta: number) => void;
  focusNode: (
    pos: { x: number; y: number },
    viewportW: number,
    viewportH: number,
    targetScale?: number
  ) => void;
  resetView: (viewportW: number, viewportH: number) => void;
  getScale: () => number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export function useCamera(): UseCameraResult {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  const springConfig = reduce ? { duration: 0 } : { stiffness: 260, damping: 28 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);
  const springScale = useSpring(scale, springConfig);

  const transform = useTransform(
    [springX, springY, springScale],
    ([tx, ty, s]) => `translate(${tx}px, ${ty}px) scale(${s})`
  );

  const panOrigin = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);

  const panStart = useCallback(
    (clientX: number, clientY: number) => {
      panOrigin.current = {
        x: clientX,
        y: clientY,
        camX: x.get(),
        camY: y.get(),
      };
    },
    [x, y]
  );

  const panMove = useCallback(
    (clientX: number, clientY: number) => {
      const origin = panOrigin.current;
      if (!origin) return;
      x.set(origin.camX + (clientX - origin.x));
      y.set(origin.camY + (clientY - origin.y));
    },
    [x, y]
  );

  const panEnd = useCallback(() => {
    panOrigin.current = null;
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, delta: number) => {
      const prev = scale.get();
      const factor = delta > 0 ? 0.9 : 1.1;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      if (next === prev) return;

      const camX = x.get();
      const camY = y.get();
      const worldX = (clientX - camX) / prev;
      const worldY = (clientY - camY) / prev;

      scale.set(next);
      x.set(clientX - worldX * next);
      y.set(clientY - worldY * next);
    },
    [x, y, scale]
  );

  const focusNode = useCallback(
    (
      pos: { x: number; y: number },
      viewportW: number,
      viewportH: number,
      targetScale = 1.1
    ) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
      scale.set(s);
      x.set(viewportW / 2 - pos.x * s);
      y.set(viewportH / 2 - pos.y * s);
    },
    [x, y, scale]
  );

  const resetView = useCallback(
    (viewportW: number, viewportH: number) => {
      scale.set(1);
      x.set(viewportW / 2);
      y.set(viewportH / 2);
    },
    [x, y, scale]
  );

  const getScale = useCallback(() => scale.get(), [scale]);

  return {
    x: springX,
    y: springY,
    scale: springScale,
    transform,
    panStart,
    panMove,
    panEnd,
    zoomAt,
    focusNode,
    resetView,
    getScale,
  };
}
