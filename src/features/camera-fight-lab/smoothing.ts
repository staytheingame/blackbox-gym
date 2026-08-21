import type { Vec3 } from "./types";

export function emaNumber(previous: number, current: number, alpha: number): number {
  return alpha * current + (1 - alpha) * previous;
}

export function emaVec3(previous: Vec3, current: Vec3, alpha: number): Vec3 {
  return {
    x: emaNumber(previous.x, current.x, alpha),
    y: emaNumber(previous.y, current.y, alpha),
    z: emaNumber(previous.z, current.z, alpha),
  };
}

export class EmaVec3Filter {
  private value: Vec3 | null = null;

  constructor(private readonly alpha: number) {}

  next(input: Vec3): Vec3 {
    this.value = this.value ? emaVec3(this.value, input, this.alpha) : { ...input };
    return this.value;
  }

  reset(): void {
    this.value = null;
  }
}

