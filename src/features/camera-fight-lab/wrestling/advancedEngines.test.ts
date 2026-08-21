import { describe, expect, it } from "vitest";
import { evaluateWrestlingCalibration } from "./calibration";
import { wrestlingPose } from "./fixtures";
import {
  adaptationAcrossPatternRepetitions,
  buildScrambleSummary,
  buildVirtualWrestlerStimulus,
  ChainSequenceTracker,
  compareFatigueBlocks,
  evaluatePatternTrial,
} from "./advancedEngines";
import { createHandFightingTarget, HandFightingEngine } from "./handFightingEngine";
import { StableStanceRecoveryTracker } from "./recoveryTracker";
import type { Hand, WristObservation } from "../types";
import type { PatternStimulus, ScrambleTrial, WrestlingMotionSnapshot, WrestlingSessionSummary } from "./protocolTypes";

const camera = { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 };
const samples = Array.from({ length: 50 }, (_, index) => wrestlingPose(index * 33));
const calibration = evaluateWrestlingCalibration(samples, camera, samples.at(-1)!.timestampMs).snapshot!;
const canvas = { width: 1_000, height: 600 };

const motion = (magnitude = 0, velocity = 0): WrestlingMotionSnapshot => ({
  bodyDisplacement: { x: magnitude, y: 0, magnitude: Math.abs(magnitude) },
  hipDisplacementM: Math.abs(magnitude) * 2,
  hipHeightDeltaNormalized: 0,
  torsoAngleDeltaDeg: 0,
  stanceWidthDeltaNormalized: 0,
  compositeVelocity: velocity,
  detectedDirection: magnitude < 0 ? "LEFT" : magnitude > 0 ? "RIGHT" : null,
});

const observation = (hand: Hand, timestampMs: number, x: number, y: number, velocityMps = 0.9): WristObservation => ({
  hand, timestampMs, world: { x: x / 500, y: y / 500, z: 0 }, image: { x: 1 - x / canvas.width, y: y / canvas.height, z: 0 },
  display: { x, y }, previousDisplay: { x: x - 35, y }, velocityMps,
  displacementFromGuardM: 0.08, displacementDeltaM: 0.025, confidence: 0.95, frameGap: false, landmarkJump: false,
});

describe("W7 hand fighting", () => {
  it("reuses wrist onset, hit and stable-return infrastructure", () => {
    const stimulus = { kind: "HAND_FIGHTING", target: "RIGHT_WRIST", requiredHand: "left" } as const;
    const target = createHandFightingTarget(calibration, canvas, stimulus);
    const engine = new HandFightingEngine(0, "hand-fighting", stimulus, calibration, target, 1_000);
    const outsideX = Math.max(20, target.displayX - target.radiusPx - 120);
    engine.update({ left: observation("left", 1_040, outsideX, target.displayY), right: null });
    engine.update({ left: observation("left", 1_073, outsideX + 45, target.displayY), right: null });
    engine.update({ left: observation("left", 1_106, target.displayX, target.displayY), right: null });
    const guardX = (1 - calibration.leftWristBaselineImage.x) * canvas.width;
    const guardY = calibration.leftWristBaselineImage.y * canvas.height;
    let result = null;
    for (let index = 0; index < 6; index += 1) result = engine.update({ left: observation("left", 1_200 + index * 33, guardX, guardY, 0.05), right: null });
    expect(result?.type).toBe("hand-fighting");
    expect(result?.correct).toBe(true);
    expect(result?.t3Ms).not.toBeNull();
  });
});

describe("W8 chain wrestling", () => {
  it("records ordered transitions and shared T3 recovery", () => {
    const stimulus = { kind: "CHAIN", sequence: ["LEVEL", "LEFT"] } as const;
    const tracker = new ChainSequenceTracker(0, stimulus, 1_000);
    tracker.recordMovement("LEVEL", 1_180, { ...motion(), detectedDirection: "LEVEL" });
    tracker.recordMovement("LEFT", 1_420, motion(-0.1, 0.7));
    let result = null;
    for (let index = 0; index < 6; index += 1) result = tracker.updateRecovery(motion(0, 0.02), 1_700 + index * 33);
    expect(result?.correct).toBe(true);
    if (result?.type === "chain") expect(result.transitionTimesMs).toEqual([240]);
  });

  it("keeps wrong order and incomplete sequences explicit", () => {
    const wrong = new ChainSequenceTracker(0, { kind: "CHAIN", sequence: ["LEFT", "FORWARD"] }, 1_000);
    const result = wrong.recordMovement("RIGHT", 1_200, motion(0.1, 0.8));
    expect(result?.outcome).toBe("WRONG_DIRECTION");
    const incomplete = new ChainSequenceTracker(0, { kind: "CHAIN", sequence: ["LEFT", "FORWARD"] }, 1_000);
    incomplete.recordMovement("LEFT", 1_200, motion(-0.1, 0.8));
    expect(incomplete.forceTimeout(4_500).error).toBe("INCOMPLETE");
  });
});

const scrambleTrial = (index: number, reaction: number, correct: boolean): ScrambleTrial => ({
  trialIndex: index, protocolId: "scramble", protocolVersion: "1.0.0", stimulus: { kind: "SCRAMBLE", command: index % 2 ? "RIGHT" : "LEFT" },
  t0Ms: index * 1_000, t1Ms: index * 1_000 + reaction, t2Ms: index * 1_000 + reaction + 100, t3Ms: null,
  reactionTimeMs: reaction, executionTimeMs: 100, totalResponseMs: reaction + 100, recoveryToStanceMs: null,
  outcome: correct ? "CORRECT" : "WRONG_DIRECTION", correct, motion: motion(), trackingQualityPct: 95, qualityFlags: [],
  type: "scramble", command: index % 2 ? "RIGHT" : "LEFT", commandIndex: index,
});

const summary = (reaction: number, accuracy: number, execution = 150): WrestlingSessionSummary => ({
  trialCount: 10, validTrialCount: 10, correctCount: accuracy / 10, accuracyPct: accuracy,
  medianReactionTimeMs: reaction, medianExecutionTimeMs: execution, medianTotalResponseMs: reaction + execution,
  medianRecoveryToStanceMs: 400, reactionConsistencyMadMs: 20, movementConsistencyMad: 0.01,
  stanceConsistencyPct: 85, falseDefenseRatePct: 10, leftMedianMs: reaction, rightMedianMs: reaction,
  absoluteDifferenceMs: 0, relativeDifferencePct: 0, trackingQualityPct: 95, qualityFlags: [],
});

describe("W9-W10 scramble and fatigue", () => {
  it("reports response and accuracy deterioration across a scramble block", () => {
    const result = buildScrambleSummary([
      scrambleTrial(0, 250, true), scrambleTrial(1, 260, true), scrambleTrial(2, 270, true),
      scrambleTrial(3, 360, true), scrambleTrial(4, 390, false), scrambleTrial(5, 420, false),
    ]);
    expect(result.reactionDeteriorationPct).toBeGreaterThan(0);
    expect(result.accuracyDeteriorationPoints).toBeGreaterThan(0);
  });

  it("compares baseline/post/recovery without diagnostic claims", () => {
    const result = compareFatigueBlocks(summary(300, 90), summary(360, 70, 190), summary(315, 85));
    expect(result.reactionChangeMs).toBe(60);
    expect(result.accuracyChangePoints).toBe(-20);
    expect(result.recoveryRetestChangeMs).toBe(15);
  });
});

describe("W11-W12 virtual wrestler and opponent reading", () => {
  it("exposes monotonic explicit animation timing events at every difficulty", () => {
    const cue = buildVirtualWrestlerStimulus("DOUBLE_LEG", 5, 10_000, () => 0.5);
    expect(cue.difficulty).toBe(5);
    expect(cue.events.cueStart).toBeLessThan(cue.events.commitStart);
    expect(cue.events.commitStart).toBeLessThan(cue.events.attackThreshold);
    expect(cue.events.attackThreshold).toBeLessThan(cue.events.recoveryEnd);
  });

  it("evaluates pattern order and adaptation across repetitions", () => {
    const stimulus: PatternStimulus = { kind: "PATTERN", patternId: "fake-double", sequence: ["FAKE", "DOUBLE_LEG"], requiredResponses: ["RESTRAINT", "SPRAWL"] };
    const first = evaluatePatternTrial({ trialIndex: 0, stimulus, detectedResponses: ["LEFT"], t0Ms: 1_000, eventTimesMs: [1_400] });
    const last = evaluatePatternTrial({ trialIndex: 1, stimulus, detectedResponses: ["SPRAWL"], t0Ms: 2_000, eventTimesMs: [2_320] });
    expect(first.patternErrors).toBe(1);
    expect(last.patternErrors).toBe(0);
    expect(adaptationAcrossPatternRepetitions([first, last]).reactionChangeMs).toBe(-80);
  });
});

describe("W13-W14 side analytics and recovery", () => {
  it("requires N consecutive stable samples for T3", () => {
    const tracker = new StableStanceRecoveryTracker(1_000);
    for (let index = 0; index < 4; index += 1) expect(tracker.update(motion(0, 0.02), 1_100 + index * 33).recovered).toBe(false);
    expect(tracker.update(motion(0, 0.02), 1_232).recovered).toBe(true);
  });

  it("resets stability on movement and reports timeout separately", () => {
    const tracker = new StableStanceRecoveryTracker(1_000);
    tracker.update(motion(0, 0.02), 1_100);
    tracker.update(motion(0.1, 0.8), 1_133);
    expect(tracker.update(motion(0, 0.02), 4_100).timedOut).toBe(true);
  });
});
