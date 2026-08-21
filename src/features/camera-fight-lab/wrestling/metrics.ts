import { mean, median, medianAbsoluteDeviation, roundMetric } from "../statistics";
import type { WrestlingSessionSummary, WrestlingTrial } from "./protocolTypes";

const numeric = (values: readonly (number | null)[]): number[] => values.filter((value): value is number => value !== null && Number.isFinite(value));

export function buildWrestlingSessionSummary(trials: readonly WrestlingTrial[]): WrestlingSessionSummary {
  const valid = trials.filter((trial) => trial.outcome !== "INVALID" && !trial.qualityFlags.includes("TRACKING_LOSS"));
  const reactions = numeric(valid.map((trial) => trial.reactionTimeMs));
  const executions = numeric(valid.map((trial) => trial.executionTimeMs));
  const totals = numeric(valid.map((trial) => trial.totalResponseMs));
  const recovery = numeric(valid.map((trial) => trial.recoveryToStanceMs));
  const movementMagnitude = numeric(valid.map((trial) => trial.motion.bodyDisplacement.magnitude));
  const stance = valid.filter((trial) => trial.type === "stance");
  const recognition = valid.filter((trial) => trial.type === "recognition");
  const fakeTrials = recognition.filter((trial) => trial.cue === "FAKE");
  const left = valid.filter((trial) => {
    if (trial.type === "shot" || trial.type === "choice") return trial.attack === "LEFT_SINGLE";
    return trial.type === "movement" && (trial.command === "LEFT" || trial.command === "CIRCLE_LEFT");
  });
  const right = valid.filter((trial) => {
    if (trial.type === "shot" || trial.type === "choice") return trial.attack === "RIGHT_SINGLE";
    return trial.type === "movement" && (trial.command === "RIGHT" || trial.command === "CIRCLE_RIGHT");
  });
  const leftMedian = median(numeric(left.map((trial) => trial.reactionTimeMs)));
  const rightMedian = median(numeric(right.map((trial) => trial.reactionTimeMs)));
  const absoluteDifference = leftMedian !== null && rightMedian !== null ? Math.abs(leftMedian - rightMedian) : null;
  const sideAverage = leftMedian !== null && rightMedian !== null ? (leftMedian + rightMedian) / 2 : null;
  const flags = [...new Set(trials.flatMap((trial) => trial.qualityFlags))];

  return {
    trialCount: trials.length,
    validTrialCount: valid.length,
    correctCount: valid.filter((trial) => trial.correct).length,
    accuracyPct: roundMetric(valid.length ? (valid.filter((trial) => trial.correct).length / valid.length) * 100 : 0) ?? 0,
    medianReactionTimeMs: roundMetric(median(reactions)),
    medianExecutionTimeMs: roundMetric(median(executions)),
    medianTotalResponseMs: roundMetric(median(totals)),
    medianRecoveryToStanceMs: roundMetric(median(recovery)),
    reactionConsistencyMadMs: roundMetric(medianAbsoluteDeviation(reactions)),
    movementConsistencyMad: roundMetric(medianAbsoluteDeviation(movementMagnitude), 4),
    stanceConsistencyPct: roundMetric(mean(stance.map((trial) => trial.stanceConsistencyPct))),
    falseDefenseRatePct: fakeTrials.length ? roundMetric((fakeTrials.filter((trial) => trial.classification === "FALSE_DEFENSE").length / fakeTrials.length) * 100) : null,
    leftMedianMs: roundMetric(leftMedian),
    rightMedianMs: roundMetric(rightMedian),
    absoluteDifferenceMs: roundMetric(absoluteDifference),
    relativeDifferencePct: roundMetric(absoluteDifference !== null && sideAverage ? (absoluteDifference / sideAverage) * 100 : null),
    trackingQualityPct: roundMetric(mean(trials.map((trial) => trial.trackingQualityPct))) ?? 0,
    qualityFlags: flags,
  };
}
