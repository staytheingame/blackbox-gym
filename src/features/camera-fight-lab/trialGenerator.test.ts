import { describe, expect, it } from "vitest";
import { createGuardZone, createTarget, randomDelayMs } from "./trialGenerator";
import type { CalibrationSnapshot } from "./types";

const calibration: CalibrationSnapshot = {
  completedAt: 1,
  shoulderWidthM: 0.4,
  shoulderWidthNormalized: 0.2,
  leftShoulderWorld: { x: -0.2, y: 0.2, z: 0 },
  rightShoulderWorld: { x: 0.2, y: 0.2, z: 0 },
  leftShoulderImage: { x: 0.4, y: 0.35, z: 0 },
  rightShoulderImage: { x: 0.6, y: 0.35, z: 0 },
  leftGuardWorld: { x: -0.14, y: 0.18, z: 0 },
  rightGuardWorld: { x: 0.14, y: 0.18, z: 0 },
  leftGuardImage: { x: 0.43, y: 0.42, z: 0 },
  rightGuardImage: { x: 0.57, y: 0.42, z: 0 },
  torsoCenterWorld: { x: 0, y: 0.2, z: 0 },
  torsoCenterImage: { x: 0.5, y: 0.35, z: 0 },
  headNeutralWorld: { x: 0, y: 0.4, z: 0 },
  headNeutralImage: { x: 0.5, y: 0.28, z: 0 },
  leftWristNoiseM: 0.01,
  rightWristNoiseM: 0.01,
  camera: { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 },
  estimatedProcessingFps: 30,
};

describe("trial generation", () => {
  it("keeps random delay inside the configured non-fixed range", () => {
    expect(randomDelayMs(() => 0)).toBe(900);
    expect(randomDelayMs(() => 0.999999)).toBeLessThanOrEqual(2_200);
    expect(randomDelayMs(() => 0.5)).not.toBe(randomDelayMs(() => 0));
  });

  it("creates reachable mirrored targets and avoids the previous zone", () => {
    const target = createTarget(calibration, { width: 1000, height: 600 }, 0, () => 0);
    expect(target.zoneIndex).not.toBe(0);
    expect(target.normalizedX).toBeGreaterThanOrEqual(0.1);
    expect(target.normalizedX).toBeLessThanOrEqual(0.9);
    expect(target.radiusPx).toBeGreaterThan(0);
    expect(target.displayX).toBeCloseTo(target.normalizedX * 1000);
  });

  it("places the guard zone at the mirrored guard point for each hand", () => {
    const canvas = { width: 1000, height: 600 };
    const left = createGuardZone(calibration, canvas, "left");
    const right = createGuardZone(calibration, canvas, "right");
    expect(left.hand).toBe("left");
    expect(left.displayX).toBeCloseTo((1 - calibration.leftGuardImage.x) * canvas.width);
    expect(right.displayX).toBeCloseTo((1 - calibration.rightGuardImage.x) * canvas.width);
    expect(left.radiusPx).toBeGreaterThan(0);
  });
});

