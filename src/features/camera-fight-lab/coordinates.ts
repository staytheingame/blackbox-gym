import type { Vec2, Vec3 } from "./types";

export type CanvasSize = { width: number; height: number };

/** MediaPipe canonical normalized coordinate -> aynalanmış display coordinate. */
export function mirrorNormalized(point: Vec2): Vec2 {
  return { x: 1 - point.x, y: point.y };
}

/** Canonical noktayı değiştirmeden aynalanmış canvas pikseline dönüştürür. */
export function imageToDisplayCanvas(point: Vec2, canvas: CanvasSize): Vec2 {
  const mirrored = mirrorNormalized(point);
  return { x: mirrored.x * canvas.width, y: mirrored.y * canvas.height };
}

export function normalizedToCanvas(point: Vec2, canvas: CanvasSize): Vec2 {
  return { x: point.x * canvas.width, y: point.y * canvas.height };
}

export function canvasToNormalized(point: Vec2, canvas: CanvasSize): Vec2 {
  if (canvas.width <= 0 || canvas.height <= 0) return { x: 0, y: 0 };
  return { x: point.x / canvas.width, y: point.y / canvas.height };
}

export function withDisplayMirror(point: Vec3): Vec3 {
  return { ...point, x: 1 - point.x };
}

