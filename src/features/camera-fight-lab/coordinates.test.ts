import { describe, expect, it } from "vitest";
import {
  canvasToNormalized,
  imageToDisplayCanvas,
  mirrorNormalized,
  normalizedToCanvas,
} from "./coordinates";

describe("camera/display coordinate transforms", () => {
  it("mirrors x once without changing y", () => {
    expect(mirrorNormalized({ x: 0.2, y: 0.35 })).toEqual({ x: 0.8, y: 0.35 });
    const roundTrip = mirrorNormalized(mirrorNormalized({ x: 0.2, y: 0.35 }));
    expect(roundTrip.x).toBeCloseTo(0.2);
    expect(roundTrip.y).toBe(0.35);
  });

  it("converts canonical normalized coordinates to mirrored canvas pixels", () => {
    expect(imageToDisplayCanvas({ x: 0.25, y: 0.5 }, { width: 800, height: 600 })).toEqual({
      x: 600,
      y: 300,
    });
  });

  it("round trips normalized display and canvas coordinates", () => {
    const canvas = { width: 1280, height: 720 };
    const normalized = { x: 0.73, y: 0.44 };
    expect(canvasToNormalized(normalizedToCanvas(normalized, canvas), canvas)).toEqual(normalized);
  });
});
