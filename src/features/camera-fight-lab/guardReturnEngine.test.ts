import { describe, expect, it } from "vitest";
import { GuardReturnTracker } from "./guardReturnEngine";
import type { WristObservation } from "./types";

const guardPoint = { x: 50, y: 50 };
const zoneRadiusPx = 20;

const wristAt = (
  timestampMs: number,
  point: { x: number; y: number },
  options: Partial<WristObservation> = {},
): WristObservation => ({
  hand: "left",
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.5, y: 0.5, z: 0 },
  display: point,
  previousDisplay: point,
  velocityMps: 0.1,
  displacementFromGuardM: 0.01,
  displacementDeltaM: 0,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

const inside = { x: 55, y: 52 };
const outside = { x: 200, y: 200 };

describe("guard return tracker mocked landmark sequences", () => {
  it("confirms T3 only after the configured consecutive-frame stability window", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3);
    expect(tracker.update(wristAt(1_050, inside), guardPoint, zoneRadiusPx)).toBeNull();
    expect(tracker.update(wristAt(1_083, inside), guardPoint, zoneRadiusPx)).toBeNull();
    const result = tracker.update(wristAt(1_116, inside), guardPoint, zoneRadiusPx);
    expect(result).toMatchObject({ outcome: "RETURNED", overshootCount: 0 });
    expect(result?.returnTimeMs).toBe(116);
  });

  it("does not count a single-frame guard crossing as a return", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3);
    expect(tracker.update(wristAt(1_050, inside), guardPoint, zoneRadiusPx)).toBeNull();
    expect(tracker.update(wristAt(1_083, outside), guardPoint, zoneRadiusPx)).toBeNull();
    expect(tracker.isResolved).toBe(false);
    expect(tracker.overshootEventCount).toBe(1);
  });

  it("reports a failed return when the hand never settles before the timeout", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3, 500);
    expect(tracker.update(wristAt(1_100, outside), guardPoint, zoneRadiusPx)).toBeNull();
    expect(tracker.update(wristAt(1_300, outside), guardPoint, zoneRadiusPx)).toBeNull();
    const result = tracker.update(wristAt(1_500, outside), guardPoint, zoneRadiusPx);
    expect(result).toMatchObject({ outcome: "FAILED_RETURN", t3Ms: null, returnTimeMs: null });
  });

  it("resolves a return through noisy in/out fluctuation and counts overshoots", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3);
    const frames: Array<[number, { x: number; y: number }]> = [
      [1_030, inside],
      [1_060, outside],
      [1_090, inside],
      [1_120, outside],
      [1_150, inside],
      [1_180, inside],
      [1_210, inside],
    ];
    let result = null;
    for (const [timestampMs, point] of frames) {
      result = tracker.update(wristAt(timestampMs, point), guardPoint, zoneRadiusPx);
    }
    expect(result).toMatchObject({ outcome: "RETURNED", overshootCount: 2, t3Ms: 1_210 });
  });

  it("wrong hand's observation is ignored", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3);
    const rightHandObservation = wristAt(1_050, inside, { hand: "right" });
    expect(tracker.update(rightHandObservation, guardPoint, zoneRadiusPx)).toBeNull();
    expect(tracker.consecutiveInsideFrames).toBe(0);
  });

  it("forceResolve reports a failed return without mutating an already-resolved outcome", () => {
    const tracker = new GuardReturnTracker("left", 1_000, 3);
    tracker.update(wristAt(1_030, inside), guardPoint, zoneRadiusPx);
    tracker.update(wristAt(1_060, inside), guardPoint, zoneRadiusPx);
    const resolved = tracker.update(wristAt(1_090, inside), guardPoint, zoneRadiusPx);
    expect(resolved?.outcome).toBe("RETURNED");
    expect(tracker.forceResolve()).toBe(resolved);
  });
});
