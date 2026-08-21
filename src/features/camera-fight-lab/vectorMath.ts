import type { Vec2, Vec3 } from "./types";

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const distance2 = (a: Vec2, b: Vec2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const distance3 = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const subtract2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const magnitude2 = (value: Vec2): number => Math.hypot(value.x, value.y);

export function cosineSimilarity2(a: Vec2, b: Vec2): number {
  const denominator = magnitude2(a) * magnitude2(b);
  if (denominator <= Number.EPSILON) return 0;
  return clamp((a.x * b.x + a.y * b.y) / denominator, -1, 1);
}

export const midpoint3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

