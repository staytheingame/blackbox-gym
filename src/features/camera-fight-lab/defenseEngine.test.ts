import { describe, expect, it } from "vitest";
import { DefenseReflexTracker } from "./defenseEngine";
import type { HeadObservation } from "./types";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
const SHOULDER_WIDTH_NORMALIZED = 0.2;
const NEUTRAL = { x: 500, y: 300 };

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

const feedNeutralRecovery = (
  tracker: DefenseReflexTracker,
  startMs: number,
  count: number,
) => {
  let result = null;
  for (let index = 0; index < count; index += 1) {
    result = tracker.update(
      headAt(startMs + index * 20, NEUTRAL, 0.05),
      NEUTRAL,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  }
  return result;
};

describe("defense reflex tracker mocked landmark sequences", () => {
  it("scores a correct slip left with stable recovery", () => {
    const tracker = new DefenseReflexTracker("SLIP_LEFT", 1_000, SHOULDER_WIDTH_NORMALIZED);
    const completion = tracker.update(
      headAt(1_200, { x: 400, y: 300 }, 1.0),
      NEUTRAL,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    expect(completion).toBeNull();
    const result = feedNeutralRecovery(tracker, 1_220, 5);
    expect(result).toMatchObject({
      outcome: "CORRECT",
      detectedAction: "SLIP_LEFT",
      onsetMs: 1_200,
      completionMs: 1_200,
    });
    expect(result?.reactionMs).toBe(200);
    expect(result?.recoveryTimeMs).toBeGreaterThan(0);
  });

  it("scores a correct slip right with stable recovery", () => {
    const tracker = new DefenseReflexTracker("SLIP_RIGHT", 1_000, SHOULDER_WIDTH_NORMALIZED);
    tracker.update(headAt(1_180, { x: 600, y: 300 }, 1.0), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    const result = feedNeutralRecovery(tracker, 1_200, 5);
    expect(result).toMatchObject({ outcome: "CORRECT", detectedAction: "SLIP_RIGHT" });
  });

  it("scores a correct duck with stable recovery", () => {
    const tracker = new DefenseReflexTracker("DUCK", 1_000, SHOULDER_WIDTH_NORMALIZED);
    tracker.update(headAt(1_150, { x: 500, y: 350 }, 1.0), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    const result = feedNeutralRecovery(tracker, 1_170, 5);
    expect(result).toMatchObject({ outcome: "CORRECT", detectedAction: "DUCK" });
  });

  it("flags wrong direction when the cued action does not match the detected movement", () => {
    const tracker = new DefenseReflexTracker("SLIP_LEFT", 1_000, SHOULDER_WIDTH_NORMALIZED);
    const result = tracker.update(
      headAt(1_200, { x: 600, y: 300 }, 1.0),
      NEUTRAL,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    expect(result).toMatchObject({ outcome: "WRONG_DIRECTION", detectedAction: "SLIP_RIGHT" });
    expect(result?.recoveryMs).toBeNull();
  });

  it("reports insufficient displacement when movement starts but never crosses the threshold", () => {
    const tracker = new DefenseReflexTracker("SLIP_LEFT", 1_000, SHOULDER_WIDTH_NORMALIZED);
    tracker.update(headAt(1_200, { x: 480, y: 300 }, 1.0), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    tracker.update(headAt(1_233, { x: 480, y: 300 }, 0.4), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    const result = tracker.finishExternally(2_000);
    expect(result.outcome).toBe("INSUFFICIENT_DISPLACEMENT");
    expect(result.onsetMs).not.toBeNull();
    expect(result.completionMs).toBeNull();
  });

  it("reports no response when the head never moves", () => {
    const tracker = new DefenseReflexTracker("DUCK", 1_000, SHOULDER_WIDTH_NORMALIZED);
    for (const t of [1_050, 1_100, 1_150]) {
      tracker.update(headAt(t, NEUTRAL, 0.05), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    const result = tracker.finishExternally(3_000);
    expect(result).toMatchObject({ outcome: "NO_RESPONSE", onsetMs: null, completionMs: null });
  });

  it("reports failed recovery when the correct defense never returns to neutral before the timeout", () => {
    const tracker = new DefenseReflexTracker("SLIP_LEFT", 1_000, SHOULDER_WIDTH_NORMALIZED);
    tracker.update(headAt(1_200, { x: 400, y: 300 }, 1.0), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    const result = tracker.update(
      headAt(1_200 + 2_300, { x: 400, y: 300 }, 0.05),
      NEUTRAL,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    expect(result).toMatchObject({
      outcome: "FAILED_RECOVERY",
      detectedAction: "SLIP_LEFT",
      recoveryMs: null,
    });
  });

  it("does not count a single-frame return as stable recovery", () => {
    const tracker = new DefenseReflexTracker("DUCK", 1_000, SHOULDER_WIDTH_NORMALIZED);
    tracker.update(headAt(1_150, { x: 500, y: 350 }, 1.0), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Tek kare nötr pozisyona döner, sonra tekrar uzaklaşır — stabil sayılmamalı.
    tracker.update(headAt(1_170, NEUTRAL, 0.05), NEUTRAL, CANVAS_WIDTH, CANVAS_HEIGHT);
    const result = tracker.update(
      headAt(1_190, { x: 500, y: 350 }, 0.05),
      NEUTRAL,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    expect(result).toBeNull();
    expect(tracker.isFinished).toBe(false);
  });
});
