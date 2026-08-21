import { describe, expect, it } from "vitest";
import { buildSessionSummary } from "./sessionMetrics";
import type {
  ComboTrialResult,
  GuardReturnResult,
  Hand,
  PeripheralZone,
  ProtocolId,
  RequiredHand,
  TrialOutcome,
  TrialResult,
  TrialStimulus,
} from "./types";

type TrialOptions = {
  protocolId: ProtocolId;
  outcome: TrialOutcome;
  kind: TrialStimulus["kind"];
  reactionMs?: number | null;
  detectedHand?: Hand | null;
  requiredHand?: RequiredHand;
  zone?: PeripheralZone | null;
};

const trial = (index: number, options: TrialOptions): TrialResult => {
  const reactionMs = options.reactionMs ?? null;
  const hitLike = options.outcome === "HIT" || options.outcome === "WRONG_HAND";
  const correctReject = options.outcome === "CORRECT_REJECT";
  const falseAttack = options.outcome === "FALSE_ATTACK";
  const side = options.zone?.endsWith("left")
    ? "left"
    : options.zone?.endsWith("right")
      ? "right"
      : options.zone === "center"
        ? "center"
        : null;
  const eccentricity = options.zone?.startsWith("inner")
    ? "inner"
    : options.zone?.startsWith("outer")
      ? "outer"
      : options.zone === "center"
        ? "center"
        : null;
  const stimulus: TrialStimulus = {
    kind: options.kind,
    requiredHand: options.requiredHand ?? "either",
    cueLabel: options.kind === "NO_GO" ? "DUR" : "VUR",
    cueColor: "#f5c400",
    peripheralZone: options.zone ?? null,
    peripheralSide: side,
    peripheralEccentricity: eccentricity,
    inhibitionWindowMs: options.kind === "NO_GO" ? 1_100 : null,
    comboSequence: null,
    defenseAction: null,
    virtualOpponentAttackType: null,
    virtualOpponentResponseChannel: null,
    virtualOpponentTempoLevel: null,
  };
  const t1Ms = reactionMs === null ? null : 1_000 + reactionMs;
  const t2Ms = hitLike && t1Ms !== null ? t1Ms + 150 : null;

  return {
    trialIndex: index,
    protocolId: options.protocolId,
    protocolVersion: "1.0.0",
    stimulus,
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
    t0Ms: 1_000,
    t1Ms,
    t2Ms,
    t3Ms: null,
    reactionTimeMs: reactionMs,
    movementTimeMs: t2Ms !== null && t1Ms !== null ? 150 : null,
    totalResponseMs: t2Ms !== null ? t2Ms - 1_000 : null,
    detectedHand: options.detectedHand ?? null,
    handConfidence: options.detectedHand ? 0.95 : null,
    firstHandToValidHit: options.outcome === "HIT" ? options.detectedHand ?? null : null,
    requiredHand: stimulus.requiredHand,
    decisionCorrect: options.outcome === "INVALID" ? null : hitLike ? options.outcome === "HIT" : correctReject,
    wrongHand: options.outcome === "WRONG_HAND",
    falseAttack,
    correctReject,
    decisionCompletedAtMs: t2Ms ?? t1Ms ?? (correctReject ? 2_100 : null),
    peakVelocityMps: hitLike ? 2 : null,
    meanPunchVelocityMps: hitLike ? 1.5 : null,
    outcome: options.outcome,
    timeout: options.outcome === "TIMEOUT",
    prematureMovement: false,
    trackingQualityPct: 95,
    processingFps: 30,
    qualityFlags: options.outcome === "TIMEOUT" ? ["TARGET_TIMEOUT", "NO_ONSET_DETECTED"] : [],
    combo: null,
    guardReturn: null,
    defense: null,
    virtualOpponent: null,
  };
};

describe("Phase 1 decision metrics", () => {
  it("reports Choice decision accuracy and wrong-hand errors", () => {
    const summary = buildSessionSummary(
      [
        trial(0, {
          protocolId: "choice-reaction",
          kind: "CHOICE",
          outcome: "HIT",
          reactionMs: 200,
          requiredHand: "left",
          detectedHand: "left",
        }),
        trial(1, {
          protocolId: "choice-reaction",
          kind: "CHOICE",
          outcome: "WRONG_HAND",
          reactionMs: 220,
          requiredHand: "right",
          detectedHand: "left",
        }),
      ],
      30,
    );
    expect(summary.decision.decisionAccuracyPct).toBe(50);
    expect(summary.decision.wrongHandCount).toBe(1);
    expect(summary.decision.medianDecisionReactionTimeMs).toBe(210);
  });

  it("counts NO_GO correct rejects and false attacks without treating them as hits", () => {
    const summary = buildSessionSummary(
      [
        trial(0, {
          protocolId: "go-no-go",
          kind: "NO_GO",
          outcome: "CORRECT_REJECT",
          requiredHand: "none",
        }),
        trial(1, {
          protocolId: "go-no-go",
          kind: "NO_GO",
          outcome: "FALSE_ATTACK",
          reactionMs: 180,
          requiredHand: "none",
          detectedHand: "right",
        }),
      ],
      30,
    );
    expect(summary.hitCount).toBe(0);
    expect(summary.decision.correctRejectCount).toBe(1);
    expect(summary.decision.falseAttackCount).toBe(1);
    expect(summary.decision.falseAttackRatePct).toBe(50);
    expect(summary.accuracyPct).toBe(50);
  });

  it("computes peripheral zone accuracy and left/right response difference", () => {
    const summary = buildSessionSummary(
      [
        trial(0, {
          protocolId: "peripheral-reaction",
          kind: "PERIPHERAL",
          outcome: "HIT",
          reactionMs: 200,
          detectedHand: "left",
          zone: "inner-left",
        }),
        trial(1, {
          protocolId: "peripheral-reaction",
          kind: "PERIPHERAL",
          outcome: "HIT",
          reactionMs: 260,
          detectedHand: "right",
          zone: "outer-right",
        }),
        trial(2, {
          protocolId: "peripheral-reaction",
          kind: "PERIPHERAL",
          outcome: "TIMEOUT",
          zone: "center",
        }),
      ],
      30,
    );
    expect(summary.decision.peripheralLeftMedianReactionTimeMs).toBe(200);
    expect(summary.decision.peripheralRightMedianReactionTimeMs).toBe(260);
    expect(summary.decision.peripheralLeftAccuracyPct).toBe(100);
    expect(summary.decision.peripheralRightAccuracyPct).toBe(100);
    expect(summary.decision.peripheralSideDifferenceMs).toBe(60);
    expect(summary.decision.peripheralZoneMetrics["inner-left"].accuracyPct).toBe(100);
    expect(summary.decision.peripheralZoneMetrics.center.accuracyPct).toBe(0);
  });
});

const comboTrial = (index: number, combo: ComboTrialResult): TrialResult => ({
  ...trial(index, {
    protocolId: "combo-speed",
    kind: "COMBO",
    outcome: combo.outcome === "COMPLETE" ? "HIT" : "WRONG_HAND",
    reactionMs: combo.steps[0]?.reactionMs ?? null,
  }),
  combo,
});

const guardReturnTrial = (index: number, guardReturn: GuardReturnResult): TrialResult => ({
  ...trial(index, {
    protocolId: "guard-return",
    kind: "GUARD_RETURN",
    outcome: "HIT",
    reactionMs: 200,
    detectedHand: guardReturn.hand,
  }),
  guardReturn,
});

describe("Phase 2 boxing motion metrics", () => {
  it("summarizes combo completion rate, inter-punch consistency and per-hand step timing", () => {
    const summary = buildSessionSummary(
      [
        comboTrial(0, {
          sequence: ["left", "right"],
          outcome: "COMPLETE",
          errorStepIndex: null,
          totalComboTimeMs: 450,
          duplicateContactRejectedCount: 0,
          steps: [
            { stepIndex: 0, expectedHand: "left", actualHand: "left", correct: true, onsetMs: 1_200, contactMs: 1_200, reactionMs: 200, interPunchMs: null, peakVelocityMps: 1.2 },
            { stepIndex: 1, expectedHand: "right", actualHand: "right", correct: true, onsetMs: 1_450, contactMs: 1_450, reactionMs: null, interPunchMs: 250, peakVelocityMps: 1.3 },
          ],
        }),
        comboTrial(1, {
          sequence: ["left", "right"],
          outcome: "WRONG_HAND",
          errorStepIndex: 0,
          totalComboTimeMs: null,
          duplicateContactRejectedCount: 0,
          steps: [
            { stepIndex: 0, expectedHand: "left", actualHand: "right", correct: false, onsetMs: 1_200, contactMs: 1_200, reactionMs: 210, interPunchMs: null, peakVelocityMps: 1.1 },
          ],
        }),
      ],
      30,
    );
    expect(summary.combo.scoredTrialCount).toBe(2);
    expect(summary.combo.completedCount).toBe(1);
    expect(summary.combo.completionRatePct).toBe(50);
    expect(summary.combo.wrongHandCount).toBe(1);
    expect(summary.combo.medianInterPunchMs).toBe(250);
    expect(summary.combo.medianTotalComboTimeMs).toBe(450);
    expect(summary.combo.leftStepMedianMs).toBe(200);
    expect(summary.combo.rightStepMedianMs).toBe(250);
  });

  it("summarizes guard return rate, T3 consistency and left/right difference", () => {
    const summary = buildSessionSummary(
      [
        guardReturnTrial(0, {
          hand: "left",
          hitMs: 1_340,
          t3Ms: 1_540,
          returnTimeMs: 200,
          outcome: "RETURNED",
          overshootCount: 0,
        }),
        guardReturnTrial(1, {
          hand: "right",
          hitMs: 1_340,
          t3Ms: 1_600,
          returnTimeMs: 260,
          outcome: "RETURNED",
          overshootCount: 1,
        }),
        guardReturnTrial(2, {
          hand: "left",
          hitMs: 1_340,
          t3Ms: null,
          returnTimeMs: null,
          outcome: "FAILED_RETURN",
          overshootCount: 0,
        }),
      ],
      30,
    );
    expect(summary.guardReturn.scoredTrialCount).toBe(3);
    expect(summary.guardReturn.returnedCount).toBe(2);
    expect(summary.guardReturn.failedReturnCount).toBe(1);
    expect(summary.guardReturn.medianReturnTimeMs).toBe(230);
    expect(summary.guardReturn.leftMedianReturnTimeMs).toBe(200);
    expect(summary.guardReturn.rightMedianReturnTimeMs).toBe(260);
    expect(summary.guardReturn.leftRightReturnDifferenceMs).toBe(60);
    expect(summary.guardReturn.overshootRatePct).toBeCloseTo(33.3, 1);
  });
});
