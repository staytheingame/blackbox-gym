import { describe, expect, it } from "vitest";
import {
  buildVirtualOpponentTimeline,
  pickVirtualOpponentAttack,
  VirtualOpponentTracker,
} from "./virtualOpponentEngine";
import type { HeadObservation, TargetSnapshot, WristObservation } from "./types";

const target: TargetSnapshot = {
  displayX: 100,
  displayY: 100,
  normalizedX: 0.5,
  normalizedY: 0.5,
  radiusPx: 20,
  radiusNormalized: 0.05,
  canvasWidth: 200,
  canvasHeight: 200,
  zoneIndex: 0,
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
const SHOULDER_WIDTH_NORMALIZED = 0.2;
const NEUTRAL = { x: 500, y: 300 };

const punchFrame = (
  hand: "left" | "right",
  timestampMs: number,
  options: Partial<WristObservation> = {},
): WristObservation => ({
  hand,
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.5, y: 0.5, z: 0 },
  display: { x: 100, y: 100 },
  previousDisplay: { x: 50, y: 100 },
  velocityMps: 1.2,
  displacementFromGuardM: 0.04,
  displacementDeltaM: 0.01,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

const emptyWrists = { left: null, right: null };

const headAt = (
  timestampMs: number,
  display: { x: number; y: number },
  velocityMps: number,
  options: Partial<HeadObservation> = {},
): HeadObservation => ({
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.5, y: 0.3, z: 0 },
  display,
  previousDisplay: NEUTRAL,
  velocityMps,
  displacementFromGuardM: 0.03,
  displacementDeltaM: 0.01,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

const counterUpdate = (
  tracker: VirtualOpponentTracker,
  hand: "left" | "right" | null,
  timestampMs: number,
  options: Partial<WristObservation> = {},
) =>
  tracker.update({
    left: hand === "left" ? punchFrame("left", timestampMs, options) : null,
    right: hand === "right" ? punchFrame("right", timestampMs, options) : null,
    head: null,
    target,
    neutralDisplay: NEUTRAL,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  });

const defendUpdate = (
  tracker: VirtualOpponentTracker,
  timestampMs: number,
  display: { x: number; y: number },
  velocityMps: number,
) =>
  tracker.update({
    left: null,
    right: null,
    head: headAt(timestampMs, display, velocityMps),
    target,
    neutralDisplay: NEUTRAL,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  });

describe("virtual opponent attack picker", () => {
  it("never repeats the previous attack type immediately", () => {
    for (const previous of ["PUNCH_COMBO", "DEFEND_CUE"] as const) {
      for (let index = 0; index < 20; index += 1) {
        const attack = pickVirtualOpponentAttack(previous, () => index / 20);
        expect(attack).not.toBe(previous);
      }
    }
  });
});

describe("virtual opponent timeline generation", () => {
  it("produces strictly increasing cueStart < attackCommit < attackLand for every tempo level", () => {
    for (const level of [1, 2, 3] as const) {
      for (let index = 0; index < 10; index += 1) {
        const timeline = buildVirtualOpponentTimeline(1_000, level, () => index / 10);
        expect(timeline.attackCommitMs).toBeGreaterThan(1_000);
        expect(timeline.attackLandMs).toBeGreaterThan(timeline.attackCommitMs);
      }
    }
  });
});

describe("virtual opponent tracker — COUNTER channel (PUNCH_COMBO)", () => {
  it("scores DEFEATED_ATTACK when the correct hand lands before the deadline", () => {
    const timeline = { attackCommitMs: 1_350, attackLandMs: 1_900 };
    const tracker = new VirtualOpponentTracker(
      "PUNCH_COMBO",
      "COUNTER",
      ["left"],
      1_000,
      1,
      timeline,
    );
    const result = counterUpdate(tracker, "left", 1_300);
    expect(result).toMatchObject({ outcome: "DEFEATED_ATTACK", responseChannel: "COUNTER" });
    expect(result?.beatDeadlineMarginMs).toBeGreaterThan(0);
  });

  it("scores TOO_LATE when the correct hand lands after the deadline but within grace", () => {
    const timeline = { attackCommitMs: 1_350, attackLandMs: 1_500 };
    const tracker = new VirtualOpponentTracker(
      "PUNCH_COMBO",
      "COUNTER",
      ["right"],
      1_000,
      1,
      timeline,
    );
    const result = counterUpdate(tracker, "right", 1_600);
    expect(result).toMatchObject({ outcome: "TOO_LATE" });
    expect(result?.beatDeadlineMarginMs).toBeLessThan(0);
  });

  it("scores WRONG_RESPONSE when the wrong hand throws", () => {
    const timeline = { attackCommitMs: 1_350, attackLandMs: 1_900 };
    const tracker = new VirtualOpponentTracker(
      "PUNCH_COMBO",
      "COUNTER",
      ["left"],
      1_000,
      1,
      timeline,
    );
    const result = counterUpdate(tracker, "right", 1_300);
    expect(result).toMatchObject({ outcome: "WRONG_RESPONSE", completionMs: null });
  });

  it("scores NO_RESPONSE when nothing happens by the grace deadline", () => {
    const timeline = { attackCommitMs: 1_350, attackLandMs: 1_500 };
    const tracker = new VirtualOpponentTracker(
      "PUNCH_COMBO",
      "COUNTER",
      ["left"],
      1_000,
      1,
      timeline,
    );
    expect(tracker.checkDeadline(1_899)).toBeNull();
    const result = tracker.checkDeadline(1_901);
    expect(result).toMatchObject({ outcome: "NO_RESPONSE" });
  });
});

describe("virtual opponent tracker — DEFEND channel (DEFEND_CUE)", () => {
  it("scores DEFEATED_ATTACK when the correct defense completes before the deadline", () => {
    const timeline = { attackCommitMs: 1_500, attackLandMs: 2_000 };
    const tracker = new VirtualOpponentTracker(
      "DEFEND_CUE",
      "DEFEND",
      "SLIP_LEFT",
      1_000,
      3,
      timeline,
      SHOULDER_WIDTH_NORMALIZED,
    );
    defendUpdate(tracker, 1_200, { x: 400, y: 300 }, 1.0);
    const result = tracker.checkDeadline(2_401);
    expect(result).toMatchObject({ outcome: "DEFEATED_ATTACK" });
    expect(result?.defense?.detectedAction).toBe("SLIP_LEFT");
    expect(result?.beatDeadlineMarginMs).toBeGreaterThan(0);
  });

  it("scores TOO_LATE when the correct defense completes after the deadline but within grace", () => {
    const timeline = { attackCommitMs: 1_100, attackLandMs: 1_200 };
    const tracker = new VirtualOpponentTracker(
      "DEFEND_CUE",
      "DEFEND",
      "DUCK",
      1_000,
      1,
      timeline,
      SHOULDER_WIDTH_NORMALIZED,
    );
    defendUpdate(tracker, 1_300, { x: 500, y: 350 }, 1.0);
    const result = tracker.checkDeadline(1_601);
    expect(result).toMatchObject({ outcome: "TOO_LATE" });
    expect(result?.beatDeadlineMarginMs).toBeLessThan(0);
  });

  it("scores WRONG_RESPONSE when the wrong direction is detected", () => {
    const timeline = { attackCommitMs: 1_500, attackLandMs: 2_000 };
    const tracker = new VirtualOpponentTracker(
      "DEFEND_CUE",
      "DEFEND",
      "SLIP_LEFT",
      1_000,
      3,
      timeline,
      SHOULDER_WIDTH_NORMALIZED,
    );
    const result = defendUpdate(tracker, 1_200, { x: 600, y: 300 }, 1.0);
    expect(result).toMatchObject({ outcome: "WRONG_RESPONSE", completionMs: null });
  });

  it("scores NO_RESPONSE when the head never moves by the grace deadline", () => {
    const timeline = { attackCommitMs: 1_100, attackLandMs: 1_200 };
    const tracker = new VirtualOpponentTracker(
      "DEFEND_CUE",
      "DEFEND",
      "DUCK",
      1_000,
      1,
      timeline,
      SHOULDER_WIDTH_NORMALIZED,
    );
    defendUpdate(tracker, 1_050, NEUTRAL, 0.05);
    defendUpdate(tracker, 1_100, NEUTRAL, 0.05);
    const result = tracker.checkDeadline(1_601);
    expect(result).toMatchObject({ outcome: "NO_RESPONSE" });
  });
});
