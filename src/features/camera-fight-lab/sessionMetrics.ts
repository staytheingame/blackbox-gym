import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { mean, median, medianAbsoluteDeviation, roundMetric } from "./statistics";
import { clamp } from "./vectorMath";
import type {
  ComboSequenceSummary,
  ComboStepResult,
  DefenseAction,
  DefenseSummary,
  GuardReturnSummary,
  Hand,
  PeripheralZone,
  PeripheralZoneMetric,
  QualityFlag,
  SessionSummary,
  TrialResult,
  VirtualOpponentResponseChannel,
  VirtualOpponentSummary,
} from "./types";

const INVALID_REACTION_FLAGS = new Set<QualityFlag>([
  "LOW_TRACKING_CONFIDENCE",
  "PREMATURE_MOVEMENT",
  "NO_ONSET_DETECTED",
  "FRAME_GAP",
  "BODY_OUT_OF_FRAME",
  "LANDMARK_JUMP",
]);

export function isValidReactionTrial(trial: TrialResult): boolean {
  return (
    trial.outcome === "HIT" &&
    trial.t0Ms !== null &&
    trial.t1Ms !== null &&
    trial.t2Ms !== null &&
    trial.reactionTimeMs !== null &&
    trial.reactionTimeMs >= 0 &&
    !trial.qualityFlags.some((flag) => INVALID_REACTION_FLAGS.has(flag))
  );
}

const hasAcceptableQuality = (trial: TrialResult): boolean =>
  !trial.qualityFlags.some((flag) => INVALID_REACTION_FLAGS.has(flag));

export function buildSessionSummary(
  trials: readonly TrialResult[],
  estimatedProcessingFps: number,
): SessionSummary {
  const valid = trials.filter(isValidReactionTrial);
  const validCorrectRejects = trials.filter(
    (trial) => trial.outcome === "CORRECT_REJECT" && hasAcceptableQuality(trial),
  );
  const reactions = valid.map((trial) => trial.reactionTimeMs as number);
  const movement = valid
    .map((trial) => trial.movementTimeMs)
    .filter((value): value is number => value !== null);
  const total = valid
    .map((trial) => trial.totalResponseMs)
    .filter((value): value is number => value !== null);
  const left = valid
    .filter((trial) => trial.detectedHand === "left")
    .map((trial) => trial.reactionTimeMs as number);
  const right = valid
    .filter((trial) => trial.detectedHand === "right")
    .map((trial) => trial.reactionTimeMs as number);

  const medianReaction = median(reactions);
  const mad = medianAbsoluteDeviation(reactions);
  const leftMedian = median(left);
  const rightMedian = median(right);
  const leftRightDifference =
    leftMedian !== null && rightMedian !== null
      ? Math.abs(leftMedian - rightMedian)
      : null;
  const sideAverage =
    leftMedian !== null && rightMedian !== null ? (leftMedian + rightMedian) / 2 : null;

  const trackingQuality = mean(trials.map((trial) => trial.trackingQualityPct)) ?? 0;
  const fpsQuality = clamp(
    (estimatedProcessingFps / PERFORMANCE_CONFIG.camera.acceptableFrameRate) * 100,
    0,
    100,
  );
  const validRatio =
    trials.length > 0
      ? ((valid.length + validCorrectRejects.length) / trials.length) * 100
      : 0;
  const sessionQualityScore = trackingQuality * 0.6 + fpsQuality * 0.25 + validRatio * 0.15;
  const sessionQuality =
    sessionQualityScore >= PERFORMANCE_CONFIG.quality.goodScoreAtLeast
      ? "GOOD"
      : sessionQualityScore >= PERFORMANCE_CONFIG.quality.fairScoreAtLeast
        ? "FAIR"
        : "POOR";

  const hitCount = trials.filter((trial) => trial.outcome === "HIT").length;
  const invalidCount = trials.filter((trial) => trial.outcome === "INVALID").length;
  const scoredTrials = trials.filter((trial) => trial.outcome !== "INVALID");
  const correctDecisionCount = scoredTrials.filter(
    (trial) => trial.decisionCorrect === true,
  ).length;
  const missCount = scoredTrials.length - correctDecisionCount;
  const decisionReactions = scoredTrials
    .filter((trial) => hasAcceptableQuality(trial))
    .map((trial) => trial.reactionTimeMs)
    .filter((value): value is number => value !== null && value >= 0);
  const noGoTrials = scoredTrials.filter((trial) => trial.stimulus.kind === "NO_GO");
  const correctRejectCount = noGoTrials.filter((trial) => trial.correctReject).length;
  const falseAttackCount = noGoTrials.filter((trial) => trial.falseAttack).length;
  const peripheralZoneMetrics = buildPeripheralZoneMetrics(scoredTrials);
  const peripheralLeft = valid
    .filter((trial) => trial.stimulus.peripheralSide === "left")
    .map((trial) => trial.reactionTimeMs as number);
  const peripheralRight = valid
    .filter((trial) => trial.stimulus.peripheralSide === "right")
    .map((trial) => trial.reactionTimeMs as number);
  const peripheralLeftMedian = median(peripheralLeft);
  const peripheralRightMedian = median(peripheralRight);
  const peripheralLeftTrials = scoredTrials.filter(
    (trial) => trial.stimulus.peripheralSide === "left",
  );
  const peripheralRightTrials = scoredTrials.filter(
    (trial) => trial.stimulus.peripheralSide === "right",
  );

  return {
    scoredTrialCount: scoredTrials.length,
    validTrialCount: valid.length + validCorrectRejects.length,
    hitCount,
    missCount,
    invalidCount,
    accuracyPct:
      roundMetric(
        scoredTrials.length > 0 ? (correctDecisionCount / scoredTrials.length) * 100 : 0,
      ) ?? 0,
    medianReactionTimeMs: roundMetric(medianReaction),
    meanReactionTimeMs: roundMetric(mean(reactions)),
    fastestReactionTimeMs: roundMetric(reactions.length > 0 ? Math.min(...reactions) : null),
    slowestReactionTimeMs: roundMetric(reactions.length > 0 ? Math.max(...reactions) : null),
    reactionConsistencyMadMs: roundMetric(mad),
    reactionConsistencyPct: roundMetric(
      medianReaction && mad !== null ? (mad / medianReaction) * 100 : null,
    ),
    medianMovementTimeMs: roundMetric(median(movement)),
    medianTotalResponseMs: roundMetric(median(total)),
    leftMedianReactionTimeMs: roundMetric(leftMedian),
    rightMedianReactionTimeMs: roundMetric(rightMedian),
    leftRightDifferenceMs: roundMetric(leftRightDifference),
    leftRightDifferencePct: roundMetric(
      leftRightDifference !== null && sideAverage
        ? (leftRightDifference / sideAverage) * 100
        : null,
    ),
    trackingQualityPct: roundMetric(trackingQuality) ?? 0,
    sessionQualityScore: roundMetric(sessionQualityScore) ?? 0,
    sessionQuality,
    decision: {
      scoredTrialCount: scoredTrials.length,
      correctDecisionCount,
      decisionAccuracyPct:
        roundMetric(
          scoredTrials.length > 0 ? (correctDecisionCount / scoredTrials.length) * 100 : 0,
        ) ?? 0,
      medianDecisionReactionTimeMs: roundMetric(median(decisionReactions)),
      wrongHandCount: scoredTrials.filter((trial) => trial.wrongHand).length,
      noGoTrialCount: noGoTrials.length,
      correctRejectCount,
      falseAttackCount,
      falseAttackRatePct:
        noGoTrials.length > 0
          ? (roundMetric((falseAttackCount / noGoTrials.length) * 100) ?? 0)
          : null,
      peripheralZoneMetrics,
      peripheralLeftMedianReactionTimeMs: roundMetric(peripheralLeftMedian),
      peripheralRightMedianReactionTimeMs: roundMetric(peripheralRightMedian),
      peripheralLeftAccuracyPct:
        peripheralLeftTrials.length > 0
          ? (roundMetric(
              (peripheralLeftTrials.filter((trial) => trial.decisionCorrect === true).length /
                peripheralLeftTrials.length) *
                100,
            ) ?? 0)
          : null,
      peripheralRightAccuracyPct:
        peripheralRightTrials.length > 0
          ? (roundMetric(
              (peripheralRightTrials.filter((trial) => trial.decisionCorrect === true).length /
                peripheralRightTrials.length) *
                100,
            ) ?? 0)
          : null,
      peripheralSideDifferenceMs: roundMetric(
        peripheralLeftMedian !== null && peripheralRightMedian !== null
          ? Math.abs(peripheralLeftMedian - peripheralRightMedian)
          : null,
      ),
    },
    combo: buildComboSummary(trials),
    guardReturn: buildGuardReturnSummary(trials),
    defense: buildDefenseSummary(trials),
    virtualOpponent: buildVirtualOpponentSummary(trials),
  };
}

function channelDefeatRatePct(
  trials: readonly TrialResult[],
  channel: VirtualOpponentResponseChannel,
): number | null {
  const channelTrials = trials.filter(
    (trial) => trial.virtualOpponent?.responseChannel === channel,
  );
  if (channelTrials.length === 0) return null;
  const defeated = channelTrials.filter(
    (trial) => trial.virtualOpponent?.outcome === "DEFEATED_ATTACK",
  );
  return roundMetric((defeated.length / channelTrials.length) * 100) ?? 0;
}

function buildVirtualOpponentSummary(trials: readonly TrialResult[]): VirtualOpponentSummary {
  const voTrials = trials.filter((trial) => trial.virtualOpponent !== null);
  const defeated = voTrials.filter((trial) => trial.virtualOpponent?.outcome === "DEFEATED_ATTACK");
  const wrongResponse = voTrials.filter(
    (trial) => trial.virtualOpponent?.outcome === "WRONG_RESPONSE",
  );
  const tooLate = voTrials.filter((trial) => trial.virtualOpponent?.outcome === "TOO_LATE");
  const noResponse = voTrials.filter((trial) => trial.virtualOpponent?.outcome === "NO_RESPONSE");
  const reactions = voTrials
    .map((trial) => trial.virtualOpponent?.reactionMs ?? null)
    .filter((value): value is number => value !== null);
  const responseTimes = voTrials
    .map((trial) => trial.virtualOpponent?.responseTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const margins = voTrials
    .map((trial) => trial.virtualOpponent?.beatDeadlineMarginMs ?? null)
    .filter((value): value is number => value !== null);

  return {
    scoredTrialCount: voTrials.length,
    defeatedCount: defeated.length,
    defeatRatePct:
      roundMetric(voTrials.length > 0 ? (defeated.length / voTrials.length) * 100 : 0) ?? 0,
    wrongResponseCount: wrongResponse.length,
    tooLateCount: tooLate.length,
    noResponseCount: noResponse.length,
    medianReactionTimeMs: roundMetric(median(reactions)),
    medianResponseTimeMs: roundMetric(median(responseTimes)),
    medianBeatDeadlineMarginMs: roundMetric(median(margins)),
    counterChannelDefeatRatePct: channelDefeatRatePct(voTrials, "COUNTER"),
    defendChannelDefeatRatePct: channelDefeatRatePct(voTrials, "DEFEND"),
  };
}

function medianReactionByAction(
  trials: readonly TrialResult[],
  action: DefenseAction,
): number | null {
  const values = trials
    .filter((trial) => trial.defense?.action === action && trial.defense.outcome === "CORRECT")
    .map((trial) => trial.defense?.reactionMs ?? null)
    .filter((value): value is number => value !== null);
  return median(values);
}

function buildDefenseSummary(trials: readonly TrialResult[]): DefenseSummary {
  const defenseTrials = trials.filter((trial) => trial.defense !== null);
  const correct = defenseTrials.filter((trial) => trial.defense?.outcome === "CORRECT");
  const reactions = correct
    .map((trial) => trial.defense?.reactionMs ?? null)
    .filter((value): value is number => value !== null);
  const recoveries = correct
    .map((trial) => trial.defense?.recoveryTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const slipLeftMedian = medianReactionByAction(defenseTrials, "SLIP_LEFT");
  const slipRightMedian = medianReactionByAction(defenseTrials, "SLIP_RIGHT");

  return {
    scoredTrialCount: defenseTrials.length,
    correctCount: correct.length,
    accuracyPct:
      roundMetric(
        defenseTrials.length > 0 ? (correct.length / defenseTrials.length) * 100 : 0,
      ) ?? 0,
    medianReactionTimeMs: roundMetric(median(reactions)),
    reactionConsistencyMadMs: roundMetric(medianAbsoluteDeviation(reactions)),
    medianRecoveryTimeMs: roundMetric(median(recoveries)),
    wrongDirectionCount: defenseTrials.filter(
      (trial) => trial.defense?.outcome === "WRONG_DIRECTION",
    ).length,
    insufficientDisplacementCount: defenseTrials.filter(
      (trial) => trial.defense?.outcome === "INSUFFICIENT_DISPLACEMENT",
    ).length,
    noResponseCount: defenseTrials.filter((trial) => trial.defense?.outcome === "NO_RESPONSE")
      .length,
    failedRecoveryCount: defenseTrials.filter(
      (trial) => trial.defense?.outcome === "FAILED_RECOVERY",
    ).length,
    slipLeftMedianReactionTimeMs: roundMetric(slipLeftMedian),
    slipRightMedianReactionTimeMs: roundMetric(slipRightMedian),
    duckMedianReactionTimeMs: roundMetric(medianReactionByAction(defenseTrials, "DUCK")),
    slipLeftRightDifferenceMs: roundMetric(
      slipLeftMedian !== null && slipRightMedian !== null
        ? Math.abs(slipLeftMedian - slipRightMedian)
        : null,
    ),
  };
}

const stepTimeMs = (step: ComboStepResult): number | null => step.reactionMs ?? step.interPunchMs;

function medianStepTimeByHand(steps: readonly ComboStepResult[], hand: Hand): number | null {
  const values = steps
    .filter((step) => step.actualHand === hand)
    .map(stepTimeMs)
    .filter((value): value is number => value !== null);
  return median(values);
}

function buildComboSummary(trials: readonly TrialResult[]): ComboSequenceSummary {
  const comboTrials = trials.filter((trial) => trial.combo !== null);
  const completed = comboTrials.filter((trial) => trial.combo?.outcome === "COMPLETE");
  const correctSteps = comboTrials.flatMap(
    (trial) => trial.combo?.steps.filter((step) => step.correct) ?? [],
  );
  const firstReactions = comboTrials
    .map((trial) => trial.combo?.steps[0]?.reactionMs ?? null)
    .filter((value): value is number => value !== null);
  const interPunchTimes = correctSteps
    .map((step) => step.interPunchMs)
    .filter((value): value is number => value !== null);
  const totalTimes = completed
    .map((trial) => trial.combo?.totalComboTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const leftMedian = medianStepTimeByHand(correctSteps, "left");
  const rightMedian = medianStepTimeByHand(correctSteps, "right");

  return {
    scoredTrialCount: comboTrials.length,
    completedCount: completed.length,
    completionRatePct:
      roundMetric(comboTrials.length > 0 ? (completed.length / comboTrials.length) * 100 : 0) ?? 0,
    wrongHandCount: comboTrials.filter((trial) => trial.combo?.outcome === "WRONG_HAND").length,
    medianFirstReactionMs: roundMetric(median(firstReactions)),
    medianInterPunchMs: roundMetric(median(interPunchTimes)),
    interPunchConsistencyMadMs: roundMetric(medianAbsoluteDeviation(interPunchTimes)),
    medianTotalComboTimeMs: roundMetric(median(totalTimes)),
    leftStepMedianMs: roundMetric(leftMedian),
    rightStepMedianMs: roundMetric(rightMedian),
    leftRightStepDifferenceMs: roundMetric(
      leftMedian !== null && rightMedian !== null ? Math.abs(leftMedian - rightMedian) : null,
    ),
  };
}

function buildGuardReturnSummary(trials: readonly TrialResult[]): GuardReturnSummary {
  const guardTrials = trials.filter((trial) => trial.guardReturn !== null);
  const returned = guardTrials.filter((trial) => trial.guardReturn?.outcome === "RETURNED");
  const failed = guardTrials.filter((trial) => trial.guardReturn?.outcome === "FAILED_RETURN");
  const returnTimes = returned
    .map((trial) => trial.guardReturn?.returnTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const leftReturnTimes = returned
    .filter((trial) => trial.guardReturn?.hand === "left")
    .map((trial) => trial.guardReturn?.returnTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const rightReturnTimes = returned
    .filter((trial) => trial.guardReturn?.hand === "right")
    .map((trial) => trial.guardReturn?.returnTimeMs ?? null)
    .filter((value): value is number => value !== null);
  const leftMedian = median(leftReturnTimes);
  const rightMedian = median(rightReturnTimes);
  const overshootTrials = guardTrials.filter(
    (trial) => (trial.guardReturn?.overshootCount ?? 0) > 0,
  );

  return {
    scoredTrialCount: guardTrials.length,
    returnedCount: returned.length,
    failedReturnCount: failed.length,
    medianReturnTimeMs: roundMetric(median(returnTimes)),
    returnConsistencyMadMs: roundMetric(medianAbsoluteDeviation(returnTimes)),
    leftMedianReturnTimeMs: roundMetric(leftMedian),
    rightMedianReturnTimeMs: roundMetric(rightMedian),
    leftRightReturnDifferenceMs: roundMetric(
      leftMedian !== null && rightMedian !== null ? Math.abs(leftMedian - rightMedian) : null,
    ),
    overshootRatePct:
      guardTrials.length > 0
        ? (roundMetric((overshootTrials.length / guardTrials.length) * 100) ?? 0)
        : null,
  };
}

const PERIPHERAL_ZONES: readonly PeripheralZone[] = [
  "center",
  "inner-left",
  "inner-right",
  "outer-left",
  "outer-right",
];

function buildPeripheralZoneMetrics(
  trials: readonly TrialResult[],
): Record<PeripheralZone, PeripheralZoneMetric> {
  return Object.fromEntries(
    PERIPHERAL_ZONES.map((zone) => {
      const zoneTrials = trials.filter((trial) => trial.stimulus.peripheralZone === zone);
      const correct = zoneTrials.filter((trial) => trial.decisionCorrect === true);
      const reactions = correct
        .filter(isValidReactionTrial)
        .map((trial) => trial.reactionTimeMs as number);
      return [
        zone,
        {
          scoredTrialCount: zoneTrials.length,
          correctCount: correct.length,
          accuracyPct:
            roundMetric(
              zoneTrials.length > 0 ? (correct.length / zoneTrials.length) * 100 : 0,
            ) ?? 0,
          medianReactionTimeMs: roundMetric(median(reactions)),
        },
      ];
    }),
  ) as Record<PeripheralZone, PeripheralZoneMetric>;
}
