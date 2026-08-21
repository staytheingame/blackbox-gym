import { mean, median, medianAbsoluteDeviation, roundMetric } from "../statistics";
import type {
  ChainStimulus,
  ChainTrial,
  PatternStimulus,
  PatternTrial,
  ScrambleTrial,
  VirtualWrestlerStimulus,
  WrestlingDirection,
  WrestlingMotionSnapshot,
  WrestlingQualityFlag,
  WrestlingSessionSummary,
  WrestlingTrial,
} from "./protocolTypes";
import { StableStanceRecoveryTracker } from "./recoveryTracker";

const emptyMotion = (): WrestlingMotionSnapshot => ({ bodyDisplacement: { x: 0, y: 0, magnitude: 0 }, hipDisplacementM: 0, hipHeightDeltaNormalized: 0, torsoAngleDeltaDeg: 0, stanceWidthDeltaNormalized: 0, compositeVelocity: 0, detectedDirection: null });

export const CHAIN_PRESETS = {
  "LEFT_SINGLE_DOUBLE": ["LEFT", "FORWARD"],
  "RIGHT_SINGLE_DOUBLE": ["RIGHT", "FORWARD"],
  "LEVEL_LEFT": ["LEVEL", "LEFT"],
  "LEVEL_RIGHT": ["LEVEL", "RIGHT"],
} as const satisfies Record<string, readonly WrestlingDirection[]>;

export class ChainSequenceTracker {
  private detected: WrestlingDirection[] = [];
  private eventTimes: number[] = [];
  private t1Ms: number | null = null;
  private t2Ms: number | null = null;
  private result: ChainTrial | null = null;
  private error: ChainTrial["error"] = null;
  private flags = new Set<WrestlingQualityFlag>();
  private recovery: StableStanceRecoveryTracker | null = null;
  private latestMotion = emptyMotion();

  constructor(private readonly trialIndex: number, private readonly stimulus: ChainStimulus, private readonly t0Ms: number) {}

  recordMovement(direction: WrestlingDirection, timestampMs: number, motion: WrestlingMotionSnapshot = emptyMotion()): ChainTrial | null {
    if (this.result || this.t2Ms !== null) return this.result;
    this.latestMotion = { ...motion, detectedDirection: direction };
    const previous = this.detected.at(-1);
    if (previous === direction) {
      this.error = "DUPLICATE_MOVEMENT";
      return null;
    }
    const expected = this.stimulus.sequence[this.detected.length];
    this.detected.push(direction);
    this.eventTimes.push(timestampMs);
    this.t1Ms ??= timestampMs;
    if (direction !== expected) {
      this.error = "WRONG_ORDER";
      this.t2Ms = timestampMs;
      this.flags.add("RESPONSE_DIRECTION_UNCLEAR");
      this.result = this.finish(null);
      return this.result;
    }
    if (this.detected.length === this.stimulus.sequence.length) {
      this.t2Ms = timestampMs;
      this.recovery = new StableStanceRecoveryTracker(timestampMs);
    }
    return null;
  }

  updateRecovery(motion: WrestlingMotionSnapshot, timestampMs: number): ChainTrial | null {
    if (this.result || !this.recovery) return this.result;
    this.latestMotion = motion;
    const update = this.recovery.update(motion, timestampMs);
    if (update.recovered) this.result = this.finish(update.t3Ms);
    else if (update.timedOut) {
      this.flags.add("RECOVERY_NOT_DETECTED");
      this.result = this.finish(null);
    }
    return this.result;
  }

  forceTimeout(nowMs: number): ChainTrial {
    if (this.result) return this.result;
    this.flags.add("TRIAL_TIMEOUT");
    if (this.detected.length < this.stimulus.sequence.length) this.error = "INCOMPLETE";
    this.t2Ms ??= this.t1Ms ? nowMs : null;
    this.result = this.finish(null);
    return this.result;
  }

  private finish(t3Ms: number | null): ChainTrial {
    const correct = this.error === null && this.detected.length === this.stimulus.sequence.length;
    return {
      trialIndex: this.trialIndex, protocolId: "chain-wrestling", protocolVersion: "1.0.0", stimulus: this.stimulus,
      t0Ms: this.t0Ms, t1Ms: this.t1Ms, t2Ms: this.t2Ms, t3Ms,
      reactionTimeMs: this.t1Ms === null ? null : this.t1Ms - this.t0Ms,
      executionTimeMs: this.t1Ms === null || this.t2Ms === null ? null : this.t2Ms - this.t1Ms,
      totalResponseMs: this.t2Ms === null ? null : this.t2Ms - this.t0Ms,
      recoveryToStanceMs: this.t2Ms === null || t3Ms === null ? null : t3Ms - this.t2Ms,
      outcome: correct ? "CORRECT" : this.error === "WRONG_ORDER" ? "WRONG_DIRECTION" : "INCOMPLETE",
      correct, motion: this.latestMotion, trackingQualityPct: 100, qualityFlags: [...this.flags],
      type: "chain", expectedSequence: this.stimulus.sequence, detectedSequence: [...this.detected],
      transitionTimesMs: this.eventTimes.slice(1).map((time, index) => time - this.eventTimes[index]), error: this.error,
    };
  }
}

export type ScrambleSummary = {
  commandCount: number;
  accuracyPct: number;
  medianReactionMs: number | null;
  reactionDeteriorationPct: number | null;
  accuracyDeteriorationPoints: number | null;
  consistencyDeteriorationMs: number | null;
};

export function buildScrambleSummary(trials: readonly ScrambleTrial[]): ScrambleSummary {
  const midpoint = Math.ceil(trials.length / 2);
  const first = trials.slice(0, midpoint);
  const last = trials.slice(midpoint);
  const reaction = (values: readonly ScrambleTrial[]) => values.map((trial) => trial.reactionTimeMs).filter((value): value is number => value !== null);
  const accuracy = (values: readonly ScrambleTrial[]) => values.length ? (values.filter((trial) => trial.correct).length / values.length) * 100 : null;
  const firstReaction = median(reaction(first));
  const lastReaction = median(reaction(last));
  const firstAccuracy = accuracy(first);
  const lastAccuracy = accuracy(last);
  const firstMad = medianAbsoluteDeviation(reaction(first));
  const lastMad = medianAbsoluteDeviation(reaction(last));
  return {
    commandCount: trials.length,
    accuracyPct: roundMetric(accuracy(trials)) ?? 0,
    medianReactionMs: roundMetric(median(reaction(trials))),
    reactionDeteriorationPct: roundMetric(firstReaction && lastReaction !== null ? ((lastReaction - firstReaction) / firstReaction) * 100 : null),
    accuracyDeteriorationPoints: roundMetric(firstAccuracy !== null && lastAccuracy !== null ? firstAccuracy - lastAccuracy : null),
    consistencyDeteriorationMs: roundMetric(firstMad !== null && lastMad !== null ? lastMad - firstMad : null),
  };
}

export type FatigueComparison = {
  reactionChangeMs: number | null;
  reactionChangePct: number | null;
  accuracyChangePoints: number;
  movementTimeChangeMs: number | null;
  consistencyChangeMs: number | null;
  recoveryChangeMs: number | null;
  recoveryRetestChangeMs: number | null;
};

export function compareFatigueBlocks(baseline: WrestlingSessionSummary, post: WrestlingSessionSummary, recovery?: WrestlingSessionSummary): FatigueComparison {
  const change = (after: number | null, before: number | null) => after === null || before === null ? null : after - before;
  const reactionChange = change(post.medianReactionTimeMs, baseline.medianReactionTimeMs);
  return {
    reactionChangeMs: roundMetric(reactionChange),
    reactionChangePct: roundMetric(reactionChange !== null && baseline.medianReactionTimeMs ? (reactionChange / baseline.medianReactionTimeMs) * 100 : null),
    accuracyChangePoints: roundMetric(post.accuracyPct - baseline.accuracyPct) ?? 0,
    movementTimeChangeMs: roundMetric(change(post.medianExecutionTimeMs, baseline.medianExecutionTimeMs)),
    consistencyChangeMs: roundMetric(change(post.reactionConsistencyMadMs, baseline.reactionConsistencyMadMs)),
    recoveryChangeMs: roundMetric(change(post.medianRecoveryToStanceMs, baseline.medianRecoveryToStanceMs)),
    recoveryRetestChangeMs: roundMetric(recovery ? change(recovery.medianReactionTimeMs, baseline.medianReactionTimeMs) : null),
  };
}

export const VIRTUAL_DIFFICULTY_TELEGRAPH_MS = [600, 500, 400, 325, 250] as const;

export function buildVirtualWrestlerStimulus(attack: VirtualWrestlerStimulus["attack"], difficulty: number, cueStart: number, rng: () => number = Math.random): VirtualWrestlerStimulus {
  const level = Math.max(1, Math.min(5, Math.round(difficulty)));
  const telegraph = VIRTUAL_DIFFICULTY_TELEGRAPH_MS[level - 1];
  const delayJitter = Math.round((rng() - 0.5) * 100);
  const commitStart = cueStart + Math.max(120, telegraph + delayJitter);
  const attackThreshold = commitStart + Math.max(120, 360 - level * 35);
  return { kind: "VIRTUAL_WRESTLER", attack, difficulty: level, events: { cueStart, commitStart, attackThreshold, recoveryEnd: attackThreshold + 420 } };
}

export const WRESTLING_PATTERNS = {
  "fake-double": { sequence: ["FAKE", "DOUBLE_LEG"], responses: ["RESTRAINT", "SPRAWL"] },
  "left-fake-right": { sequence: ["LEFT_SINGLE", "FAKE", "RIGHT_SINGLE"], responses: ["LEFT", "RESTRAINT", "RIGHT"] },
  "double-reset-double": { sequence: ["DOUBLE_LEG", "RESET", "DOUBLE_LEG"], responses: ["SPRAWL", "STAND", "SPRAWL"] },
} as const;

export function evaluatePatternTrial(input: { trialIndex: number; stimulus: PatternStimulus; detectedResponses: readonly WrestlingDirection[]; t0Ms: number; eventTimesMs: readonly number[]; motion?: WrestlingMotionSnapshot }): PatternTrial {
  const expectedMovement = input.stimulus.requiredResponses.filter((response): response is WrestlingDirection => response !== "RESTRAINT");
  const errors = Math.max(expectedMovement.length, input.detectedResponses.length) - expectedMovement.filter((response, index) => input.detectedResponses[index] === response).length;
  const t1Ms = input.eventTimesMs[0] ?? null;
  const t2Ms = input.eventTimesMs.at(-1) ?? null;
  return {
    trialIndex: input.trialIndex, protocolId: "opponent-reading", protocolVersion: "1.0.0", stimulus: input.stimulus,
    t0Ms: input.t0Ms, t1Ms, t2Ms, t3Ms: null,
    reactionTimeMs: t1Ms === null ? null : t1Ms - input.t0Ms,
    executionTimeMs: t1Ms === null || t2Ms === null ? null : t2Ms - t1Ms,
    totalResponseMs: t2Ms === null ? null : t2Ms - input.t0Ms, recoveryToStanceMs: null,
    outcome: errors === 0 ? "CORRECT" : "WRONG_DIRECTION", correct: errors === 0,
    motion: input.motion ?? emptyMotion(), trackingQualityPct: 100,
    qualityFlags: errors > 0 ? ["RESPONSE_DIRECTION_UNCLEAR"] : [], type: "pattern", patternId: input.stimulus.patternId,
    expectedResponses: input.stimulus.requiredResponses, detectedResponses: input.detectedResponses, patternErrors: errors,
  };
}

export function adaptationAcrossPatternRepetitions(trials: readonly PatternTrial[]): { reactionChangeMs: number | null; errorChange: number } {
  if (trials.length < 2) return { reactionChangeMs: null, errorChange: 0 };
  const first = trials[0];
  const last = trials.at(-1)!;
  return {
    reactionChangeMs: first.reactionTimeMs === null || last.reactionTimeMs === null ? null : roundMetric(last.reactionTimeMs - first.reactionTimeMs),
    errorChange: last.patternErrors - first.patternErrors,
  };
}

export const averageTrackingQuality = (trials: readonly WrestlingTrial[]): number => roundMetric(mean(trials.map((trial) => trial.trackingQualityPct))) ?? 0;
