import { describe, expect, it } from "vitest";
import { EmaVec3Filter, emaNumber } from "./smoothing";
import { cosineSimilarity2, distance2, distance3 } from "./vectorMath";
import { velocityMps } from "./velocity";

describe("vector math", () => {
  it("calculates 2D and 3D distance", () => {
    expect(distance2({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance3({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 })).toBe(7);
  });

  it("calculates direction cosine", () => {
    expect(cosineSimilarity2({ x: 2, y: 0 }, { x: 9, y: 0 })).toBe(1);
    expect(cosineSimilarity2({ x: 2, y: 0 }, { x: -9, y: 0 })).toBe(-1);
  });
});

describe("velocity and smoothing", () => {
  it("calculates metric velocity using milliseconds", () => {
    expect(velocityMps({ x: 0, y: 0, z: 0 }, { x: 0.1, y: 0, z: 0 }, 50)).toBeCloseTo(2);
  });

  it("applies an EMA without mutating inputs", () => {
    expect(emaNumber(0, 10, 0.25)).toBe(2.5);
    const filter = new EmaVec3Filter(0.5);
    const first = { x: 0, y: 0, z: 0 };
    expect(filter.next(first)).toEqual(first);
    expect(filter.next({ x: 2, y: 4, z: 6 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});

