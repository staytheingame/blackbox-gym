import { describe, expect, it } from "vitest";
import { checkHit } from "./hitDetector";
import { hasPrematureMovement, OnsetDetector } from "./onsetDetector";
import type { Hand, TargetSnapshot, WristObservation } from "./types";

const observation = (
  timestampMs: number,
  velocityMps: number,
  options: Partial<WristObservation> = {},
): WristObservation => ({
  hand: "left",
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.5, y: 0.5, z: 0 },
  display: { x: 100, y: 100 },
  previousDisplay: { x: 50, y: 100 },
  velocityMps,
  displacementFromGuardM: 0.04,
  displacementDeltaM: 0.01,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

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

describe("onset detector mocked landmark sequences", () => {
  it("no movement never triggers", () => {
    const detector = new OnsetDetector();
    for (const t of [1_010, 1_044, 1_078, 1_112]) {
      expect(detector.update(observation(t, 0.05), 1_000).detected).toBe(false);
    }
  });

  it("noisy wrist jitter does not trigger", () => {
    const detector = new OnsetDetector();
    for (const [index, speed] of [0.1, 0.42, 0.18, 0.48, 0.12].entries()) {
      expect(detector.update(observation(1_010 + index * 33, speed), 1_000).detected).toBe(false);
    }
  });

  it("valid punch stores the earliest confirmed frame as T1", () => {
    const detector = new OnsetDetector();
    expect(detector.update(observation(1_033, 0.62), 1_000).detected).toBe(false);
    expect(detector.update(observation(1_066, 0.81), 1_000)).toMatchObject({
      detected: true,
      t1Ms: 1_033,
    });
  });

  it("slow hand placement does not create onset", () => {
    const detector = new OnsetDetector();
    for (const t of [1_033, 1_066, 1_099, 1_132]) {
      expect(detector.update(observation(t, 0.22), 1_000).detected).toBe(false);
    }
  });

  it("tracking dropout breaks the candidate sequence", () => {
    const detector = new OnsetDetector();
    detector.update(observation(1_033, 0.7), 1_000);
    detector.update(observation(1_066, 0, { confidence: 0.1 }), 1_000);
    expect(detector.update(observation(1_099, 0.7), 1_000).detected).toBe(false);
  });

  it("flags a premature punch only with persistent pre-target motion", () => {
    const history = [
      observation(850, 0.1),
      observation(900, 0.6),
      observation(933, 0.7),
      observation(1_033, 0.1),
    ];
    expect(hasPrematureMovement(history, 1_000)).toBe(true);
    expect(hasPrematureMovement([observation(950, 0.7)], 1_000)).toBe(false);
  });
});

describe("hit detector mocked landmark sequences", () => {
  const validInput = (hand: Hand = "left") => ({
    targetActive: true,
    trialCompleted: false,
    observation: observation(1_250, 1.2, { hand }),
    target,
    t1Ms: 1_100,
    wasOutsideTarget: true,
  });

  it("accepts a fast directed left punch", () => {
    expect(checkHit(validInput("left"))).toMatchObject({ accepted: true, reason: null });
  });

  it("accepts a fast directed right punch without swapping handedness", () => {
    expect(checkHit(validInput("right"))).toMatchObject({ accepted: true, reason: null });
    expect(validInput("right").observation.hand).toBe("right");
  });

  it("rejects slow hand placement", () => {
    expect(
      checkHit({
        ...validInput(),
        observation: observation(1_250, 0.2),
      }),
    ).toMatchObject({ accepted: false, reason: "INVALID_HIT_SPEED" });
  });

  it("rejects a wrist that was already inside", () => {
    expect(checkHit({ ...validInput(), wasOutsideTarget: false })).toMatchObject({
      accepted: false,
      reason: "HAND_ALREADY_IN_TARGET",
    });
  });

  it("rejects motion directed away from the target", () => {
    expect(
      checkHit({
        ...validInput(),
        observation: observation(1_250, 1.2, {
          display: { x: 125, y: 100 },
          previousDisplay: { x: 115, y: 100 },
        }),
      }),
    ).toMatchObject({ accepted: false, reason: "INVALID_HIT_DIRECTION" });
  });

  it("does not create a phantom hit at the unmirrored coordinate", () => {
    expect(
      checkHit({
        ...validInput(),
        observation: observation(1_250, 1.2, {
          display: { x: 20, y: 100 },
          previousDisplay: { x: 10, y: 100 },
        }),
      }),
    ).toMatchObject({ accepted: false, insideTarget: false });
  });
});
