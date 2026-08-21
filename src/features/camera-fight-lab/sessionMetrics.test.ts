import { describe, expect, it } from "vitest";
import { buildSessionSummary } from "./sessionMetrics";
import { mean, median, medianAbsoluteDeviation } from "./statistics";
import type { Hand, TrialResult, VirtualOpponentOutcome, VirtualOpponentResponseChannel } from "./types";

const trial = (
  reactionTimeMs: number | null,
  hand: Hand | null,
  outcome: TrialResult["outcome"] = "HIT",
): TrialResult => ({
  trialIndex: 0,
  protocolId: "full-reaction",
  protocolVersion: "1.0.0",
  stimulus: {
    kind: "SIMPLE",
    requiredHand: "either",
    cueLabel: "VUR",
    cueColor: "#f5c400",
    peripheralZone: null,
    peripheralSide: null,
    peripheralEccentricity: null,
    inhibitionWindowMs: null,
    comboSequence: null,
    defenseAction: null,
    virtualOpponentAttackType: null,
    virtualOpponentResponseChannel: null,
    virtualOpponentTempoLevel: null,
  },
  target: {
    displayX: 100,
    displayY: 100,
    normalizedX: 0.5,
    normalizedY: 0.5,
    radiusPx: 30,
    radiusNormalized: 0.05,
    canvasWidth: 200,
    canvasHeight: 200,
    zoneIndex: 0,
  },
  targetDelayMs: 1_200,
  t0Ms: reactionTimeMs === null ? 1_000 : 1_000,
  t1Ms: reactionTimeMs === null ? null : 1_000 + reactionTimeMs,
  t2Ms: reactionTimeMs === null ? null : 1_000 + reactionTimeMs + 150,
  t3Ms: null,
  reactionTimeMs,
  movementTimeMs: reactionTimeMs === null ? null : 150,
  totalResponseMs: reactionTimeMs === null ? null : reactionTimeMs + 150,
  detectedHand: hand,
  handConfidence: hand ? 0.9 : null,
  firstHandToValidHit: hand,
  requiredHand: "either",
  decisionCorrect: outcome === "INVALID" ? null : outcome === "HIT",
  wrongHand: false,
  falseAttack: false,
  correctReject: false,
  decisionCompletedAtMs: reactionTimeMs === null ? null : 1_000 + reactionTimeMs + 150,
  peakVelocityMps: hand ? 2 : null,
  meanPunchVelocityMps: hand ? 1.4 : null,
  outcome,
  timeout: outcome === "TIMEOUT",
  prematureMovement: false,
  trackingQualityPct: 90,
  processingFps: 30,
  qualityFlags: outcome === "TIMEOUT" ? ["TARGET_TIMEOUT", "NO_ONSET_DETECTED"] : [],
  combo: null,
  guardReturn: null,
  defense: null,
  virtualOpponent: null,
});

const virtualOpponentTrial = (
  outcome: VirtualOpponentOutcome,
  responseChannel: VirtualOpponentResponseChannel,
  reactionMs: number | null,
  responseTimeMs: number | null,
  beatDeadlineMarginMs: number | null,
): TrialResult => ({
  ...trial(reactionMs, null, outcome === "DEFEATED_ATTACK" ? "HIT" : "MISS"),
  virtualOpponent: {
    attackType: responseChannel === "COUNTER" ? "PUNCH_COMBO" : "DEFEND_CUE",
    responseChannel,
    tempoLevel: 2,
    cueStartMs: 1_000,
    attackCommitMs: 1_500,
    attackLandMs: 1_800,
    onsetMs: reactionMs === null ? null : 1_000 + reactionMs,
    completionMs: responseTimeMs === null ? null : 1_000 + responseTimeMs,
    reactionMs,
    responseTimeMs,
    beatDeadlineMarginMs,
    outcome,
    combo: null,
    defense: null,
  },
});

describe("statistics", () => {
  it("calculates mean, median and MAD robustly", () => {
    expect(mean([1, 2, 9])).toBe(4);
    expect(median([9, 1, 2, 4])).toBe(3);
    expect(medianAbsoluteDeviation([100, 105, 110, 500])).toBe(5);
  });
});

describe("session summary", () => {
  it("uses valid hits, reports accuracy denominator and left/right difference", () => {
    const summary = buildSessionSummary(
      [trial(200, "left"), trial(220, "left"), trial(260, "right"), trial(null, null, "TIMEOUT")],
      30,
    );
    expect(summary.scoredTrialCount).toBe(4);
    expect(summary.validTrialCount).toBe(3);
    expect(summary.accuracyPct).toBe(75);
    expect(summary.medianReactionTimeMs).toBe(220);
    expect(summary.leftMedianReactionTimeMs).toBe(210);
    expect(summary.rightMedianReactionTimeMs).toBe(260);
    expect(summary.leftRightDifferenceMs).toBe(50);
    expect(summary.leftRightDifferencePct).toBeCloseTo(21.3, 1);
  });

  it("handles missing side data safely", () => {
    const summary = buildSessionSummary([trial(210, "left")], 30);
    expect(summary.rightMedianReactionTimeMs).toBeNull();
    expect(summary.leftRightDifferenceMs).toBeNull();
  });
});

describe("virtual opponent summary", () => {
  it("counts outcomes and computes per-channel defeat rates", () => {
    const summary = buildSessionSummary(
      [
        virtualOpponentTrial("DEFEATED_ATTACK", "COUNTER", 220, 300, 350),
        virtualOpponentTrial("TOO_LATE", "COUNTER", 260, 900, -150),
        virtualOpponentTrial("WRONG_RESPONSE", "COUNTER", 210, null, null),
        virtualOpponentTrial("DEFEATED_ATTACK", "DEFEND", 300, 500, 400),
        virtualOpponentTrial("NO_RESPONSE", "DEFEND", null, null, null),
      ],
      30,
    );
    expect(summary.virtualOpponent.scoredTrialCount).toBe(5);
    expect(summary.virtualOpponent.defeatedCount).toBe(2);
    expect(summary.virtualOpponent.defeatRatePct).toBe(40);
    expect(summary.virtualOpponent.tooLateCount).toBe(1);
    expect(summary.virtualOpponent.wrongResponseCount).toBe(1);
    expect(summary.virtualOpponent.noResponseCount).toBe(1);
    expect(summary.virtualOpponent.counterChannelDefeatRatePct).toBeCloseTo(33.33, 1);
    expect(summary.virtualOpponent.defendChannelDefeatRatePct).toBe(50);
    expect(summary.virtualOpponent.medianBeatDeadlineMarginMs).not.toBeNull();
  });

  it("returns zero-valued summary and null channel rates for non-virtual-opponent sessions", () => {
    const summary = buildSessionSummary([trial(200, "left")], 30);
    expect(summary.virtualOpponent.scoredTrialCount).toBe(0);
    expect(summary.virtualOpponent.defeatRatePct).toBe(0);
    expect(summary.virtualOpponent.counterChannelDefeatRatePct).toBeNull();
    expect(summary.virtualOpponent.defendChannelDefeatRatePct).toBeNull();
  });
});
