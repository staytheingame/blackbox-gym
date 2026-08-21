import { describe, expect, it } from "vitest";
import {
  INITIAL_GAME_STATE,
  transitionGameState,
  type GameState,
} from "./gameStateMachine";
import type { TargetSnapshot, TrialResult, TrialStimulus } from "./types";

const stimulus: TrialStimulus = {
  comboSequence: null,
  defenseAction: null,
  kind: "SIMPLE",
  requiredHand: "either",
  cueLabel: "VUR",
  cueColor: "#f5c400",
  peripheralZone: null,
  peripheralSide: null,
  peripheralEccentricity: null,
  inhibitionWindowMs: null,
  virtualOpponentAttackType: null,
  virtualOpponentResponseChannel: null,
  virtualOpponentTempoLevel: null,
};

const target: TargetSnapshot = {
  displayX: 100,
  displayY: 100,
  normalizedX: 0.5,
  normalizedY: 0.5,
  radiusPx: 30,
  radiusNormalized: 0.05,
  canvasWidth: 200,
  canvasHeight: 200,
  zoneIndex: 0,
};

const result: TrialResult = {
  trialIndex: 0,
  protocolId: "full-reaction",
  protocolVersion: "1.0.0",
  stimulus,
  target,
  targetDelayMs: 1_000,
  t0Ms: 5_000,
  t1Ms: 5_200,
  t2Ms: 5_350,
  t3Ms: null,
  reactionTimeMs: 200,
  movementTimeMs: 150,
  totalResponseMs: 350,
  detectedHand: "left",
  handConfidence: 0.9,
  firstHandToValidHit: "left",
  requiredHand: "either",
  decisionCorrect: true,
  wrongHand: false,
  falseAttack: false,
  correctReject: false,
  decisionCompletedAtMs: 5_350,
  peakVelocityMps: 2,
  meanPunchVelocityMps: 1.5,
  outcome: "HIT",
  timeout: false,
  prematureMovement: false,
  trackingQualityPct: 95,
  processingFps: 30,
  qualityFlags: [],
  combo: null,
  guardReturn: null,
  defense: null,
  virtualOpponent: null,
};

describe("trial state machine", () => {
  it("follows the explicit V0.1 happy path", () => {
    let state = transitionGameState(INITIAL_GAME_STATE, { type: "START" });
    expect(state.status).toBe("CAMERA_PERMISSION");
    state = transitionGameState(state, { type: "CAMERA_GRANTED" });
    state = transitionGameState(state, { type: "BEGIN_CALIBRATION" });
    state = transitionGameState(state, { type: "CALIBRATION_PASSED" });
    state = transitionGameState(state, { type: "START_SESSION" });
    state = transitionGameState(state, { type: "COUNTDOWN_DONE" });
    state = transitionGameState(state, {
      type: "PREPARE_TRIAL",
      trial: { trialIndex: 0, target, targetDelayMs: 1_000, t0Ms: null, stimulus },
    });
    state = transitionGameState(state, { type: "TARGET_SHOWN", t0Ms: 5_000 });
    state = transitionGameState(state, { type: "TRIAL_FINISHED", result });
    state = transitionGameState(state, { type: "NEXT_TRIAL", trialCount: 1 });
    expect(state.status).toBe("SESSION_COMPLETE");
    expect(state.results).toEqual([result]);
  });

  it("ignores invalid transitions and supports pause/resume", () => {
    expect(transitionGameState(INITIAL_GAME_STATE, { type: "START_SESSION" })).toBe(
      INITIAL_GAME_STATE,
    );
    const countdown = { ...INITIAL_GAME_STATE, status: "COUNTDOWN" as const };
    const paused = transitionGameState(countdown, { type: "PAUSE" });
    expect(paused.status).toBe("PAUSED");
    expect(transitionGameState(paused, { type: "RESUME" }).status).toBe("COUNTDOWN");
  });

  it("completes exactly 20 trials before showing session results", () => {
    let state: GameState = { ...INITIAL_GAME_STATE, status: "WAITING_FOR_TARGET" };

    for (let trialIndex = 0; trialIndex < 20; trialIndex += 1) {
      state = transitionGameState(state, {
        type: "PREPARE_TRIAL",
        trial: { trialIndex, target, targetDelayMs: 1_000, t0Ms: null, stimulus },
      });
      state = transitionGameState(state, { type: "TARGET_SHOWN", t0Ms: 5_000 });
      state = transitionGameState(state, {
        type: "TRIAL_FINISHED",
        result: { ...result, trialIndex },
      });
      state = transitionGameState(state, { type: "NEXT_TRIAL", trialCount: 20 });

      expect(state.status).toBe(trialIndex === 19 ? "SESSION_COMPLETE" : "WAITING_FOR_TARGET");
    }

    expect(state.results).toHaveLength(20);
    expect(state.trialIndex).toBe(19);
  });
});
