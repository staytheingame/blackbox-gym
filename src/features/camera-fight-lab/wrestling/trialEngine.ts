import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { medianAbsoluteDeviation } from "../statistics";
import { distance3 } from "../vectorMath";
import type { PoseSample } from "../types";
import { extractWrestlingFeatures } from "./features";
import { WRESTLING_PROTOCOLS } from "./protocols";
import type {
  StanceStimulus,
  WrestlingDirection,
  WrestlingMotionSnapshot,
  WrestlingProtocolId,
  WrestlingQualityFlag,
  WrestlingStimulus,
  WrestlingTrial,
  WrestlingTrialBase,
  WrestlingTrialOutcome,
} from "./protocolTypes";
import type { WrestlingCalibrationSnapshot, WrestlingPoseFeatures } from "./types";
import { StableStanceRecoveryTracker } from "./recoveryTracker";

const config = PERFORMANCE_CONFIG.wrestling;

type TrialEngineInput = {
  trialIndex: number;
  protocolId: WrestlingProtocolId;
  stimulus: WrestlingStimulus;
  calibration: WrestlingCalibrationSnapshot;
  t0Ms: number;
};

const emptyMotion = (): WrestlingMotionSnapshot => ({
  bodyDisplacement: { x: 0, y: 0, magnitude: 0 },
  hipDisplacementM: 0,
  hipHeightDeltaNormalized: 0,
  torsoAngleDeltaDeg: 0,
  stanceWidthDeltaNormalized: 0,
  compositeVelocity: 0,
  detectedDirection: null,
});

const normalizedDirection = (value: WrestlingDirection | null): WrestlingDirection | null => {
  if (value === "CIRCLE_LEFT") return "LEFT";
  if (value === "CIRCLE_RIGHT") return "RIGHT";
  return value;
};

const requiredDirection = (stimulus: WrestlingStimulus): WrestlingDirection | null => {
  if ("requiredDirection" in stimulus && stimulus.requiredDirection !== "RESTRAINT") return stimulus.requiredDirection;
  if (stimulus.kind === "SCRAMBLE") return stimulus.command;
  return null;
};

export class WrestlingTrialEngine {
  private previous: WrestlingPoseFeatures | null = null;
  private previousPose: PoseSample | null = null;
  private t1Ms: number | null = null;
  private t2Ms: number | null = null;
  private t3Ms: number | null = null;
  private onsetCandidateMs: number | null = null;
  private onsetFrames = 0;
  private completionFrames = 0;
  private recoveryTracker: StableStanceRecoveryTracker | null = null;
  private usableFrames = 0;
  private totalFrames = 0;
  private trackingLossFrames = 0;
  private resolved: WrestlingTrial | null = null;
  private latestMotion: WrestlingMotionSnapshot = emptyMotion();
  private detectedDirection: WrestlingDirection | null = null;
  private seenDirections = new Set<WrestlingDirection>();
  private maxSprawlSignals = 0;
  private qualityFlags = new Set<WrestlingQualityFlag>();
  private stanceFeatures: WrestlingPoseFeatures[] = [];

  constructor(private readonly input: TrialEngineInput) {}

  update(sample: PoseSample): WrestlingTrial | null {
    if (this.resolved) return this.resolved;
    this.totalFrames += 1;
    const feature = extractWrestlingFeatures(sample);
    if (!feature || feature.confidence < config.calibration.minVisibility) {
      this.trackingLossFrames += 1;
      this.qualityFlags.add("LOW_TRACKING_CONFIDENCE");
      if (!feature) this.qualityFlags.add("INSUFFICIENT_KNEE_TRACKING");
      return this.maybeTimeout(sample.timestampMs);
    }
    this.usableFrames += 1;
    this.stanceFeatures.push(feature);
    const compositeVelocity = this.compositeVelocity(feature, sample);
    this.latestMotion = this.motionSnapshot(feature, compositeVelocity);
    this.maxSprawlSignals = Math.max(this.maxSprawlSignals, this.sprawlSignals());
    this.previous = feature;
    this.previousPose = sample;

    if (this.input.stimulus.kind === "STANCE") {
      if (sample.timestampMs >= this.input.t0Ms + this.input.stimulus.durationMs) {
        this.resolved = this.finishStance(sample.timestampMs, this.input.stimulus);
      }
      return this.resolved;
    }

    if (
      this.input.stimulus.kind === "RECOGNITION" &&
      this.input.stimulus.cue === "FAKE" &&
      this.t1Ms === null &&
      sample.timestampMs >= this.input.t0Ms + config.motion.restraintWindowMs
    ) {
      this.resolved = this.finish("CORRECT", null, this.input.t0Ms + config.motion.restraintWindowMs, null);
      return this.resolved;
    }

    if (this.t1Ms === null) this.detectOnset(sample.timestampMs, compositeVelocity);
    if (this.t1Ms !== null && this.input.stimulus.kind === "RECOGNITION" && this.input.stimulus.cue === "FAKE") {
      this.resolved = this.finish("FALSE_DEFENSE", this.t1Ms, this.t1Ms, null);
      return this.resolved;
    }

    if (this.t1Ms !== null && this.t2Ms === null) this.detectCompletion(sample.timestampMs);
    if (this.t2Ms !== null && this.t3Ms === null) {
      this.recoveryTracker ??= new StableStanceRecoveryTracker(this.t2Ms);
      const recovery = this.recoveryTracker.update(this.latestMotion, sample.timestampMs);
      if (recovery.recovered) {
        this.t3Ms = recovery.t3Ms;
        this.resolved = this.finish(this.isCorrectDirection() ? "CORRECT" : "WRONG_DIRECTION", this.t1Ms, this.t2Ms, this.t3Ms);
      } else if (recovery.timedOut) {
        this.qualityFlags.add("RECOVERY_NOT_DETECTED");
        this.resolved = this.finish(this.isCorrectDirection() ? "CORRECT" : "WRONG_DIRECTION", this.t1Ms, this.t2Ms, null);
      }
    }
    return this.resolved ?? this.maybeTimeout(sample.timestampMs);
  }

  forceTimeout(nowMs: number): WrestlingTrial {
    if (this.resolved) return this.resolved;
    this.qualityFlags.add("TRIAL_TIMEOUT");
    if (this.input.stimulus.kind === "SPRAWL") this.qualityFlags.add("SPRAWL_NOT_DETECTED");
    if (this.trackingLossFrames > Math.max(2, this.totalFrames * 0.25)) this.qualityFlags.add("TRACKING_LOSS");
    const recognition = this.input.stimulus.kind === "RECOGNITION" ? this.input.stimulus : null;
    const outcome: WrestlingTrialOutcome = recognition?.cue === "REAL_SHOT" ? "MISSED_DEFENSE" : this.t1Ms === null ? "NO_RESPONSE" : "INCOMPLETE";
    this.resolved = this.finish(outcome, this.t1Ms, this.t2Ms ?? (this.t1Ms ? nowMs : null), null);
    return this.resolved;
  }

  getResult(): WrestlingTrial | null {
    return this.resolved;
  }

  private detectOnset(timestampMs: number, compositeVelocity: number): void {
    const displacement = this.latestMotion.bodyDisplacement.magnitude;
    const sprawlSignals = this.sprawlSignals();
    const meaningful = compositeVelocity >= config.motion.onsetCompositeVelocity && (displacement >= config.motion.directionDeadZoneNormalized || sprawlSignals >= 2);
    if (!meaningful) {
      this.onsetFrames = 0;
      this.onsetCandidateMs = null;
      return;
    }
    if (this.onsetCandidateMs === null) this.onsetCandidateMs = timestampMs;
    this.onsetFrames += 1;
    if (this.onsetFrames >= config.motion.onsetConsecutiveFrames) this.t1Ms = this.onsetCandidateMs;
  }

  private detectCompletion(timestampMs: number): void {
    const expected = requiredDirection(this.input.stimulus);
    const detected = this.directionFromMotion(expected);
    if (detected) {
      if (this.detectedDirection && normalizedDirection(this.detectedDirection) !== normalizedDirection(detected)) this.qualityFlags.add("MULTIPLE_MOVEMENTS");
      this.detectedDirection = detected;
      this.seenDirections.add(detected);
      this.latestMotion = { ...this.latestMotion, detectedDirection: detected };
    }
    const thresholdReached = expected === "SPRAWL"
      ? this.sprawlSignals() >= 2
      : this.latestMotion.bodyDisplacement.magnitude >= (this.input.stimulus.kind === "MOVEMENT" ? config.motion.movementCompletionDisplacementNormalized : config.motion.shotCompletionDisplacementNormalized);
    if (thresholdReached && detected) {
      this.completionFrames += 1;
      if (this.completionFrames >= config.motion.completionConsecutiveFrames) this.t2Ms = timestampMs;
    } else {
      this.completionFrames = 0;
    }
  }

  private compositeVelocity(current: WrestlingPoseFeatures, sample: PoseSample): number {
    if (!this.previous || !this.previousPose) return 0;
    const deltaMs = current.timestampMs - this.previous.timestampMs;
    if (deltaMs <= 0 || deltaMs > 180) return 0;
    const seconds = deltaMs / 1_000;
    const hip = distance3(this.previous.hipCenterWorld, current.hipCenterWorld) / seconds;
    const body = distance3(this.previous.bodyCenterWorld, current.bodyCenterWorld) / seconds;
    const knee = distance3(this.previous.kneeCenterWorld, current.kneeCenterWorld) / seconds;
    const wristVelocities = ["leftWrist", "rightWrist"] as const;
    const wrist = Math.max(...wristVelocities.map((key) => {
      const before = this.previousPose?.world[key];
      const after = sample.world[key];
      return before && after ? distance3(before, after) / seconds : 0;
    }));
    return hip * 0.32 + body * 0.28 + knee * 0.24 + wrist * 0.16;
  }

  private motionSnapshot(feature: WrestlingPoseFeatures, compositeVelocity: number): WrestlingMotionSnapshot {
    const dx = feature.bodyCenterImage.x - this.input.calibration.bodyCenterImage.x;
    const dy = feature.bodyCenterImage.y - this.input.calibration.bodyCenterImage.y;
    return {
      bodyDisplacement: { x: dx, y: dy, magnitude: Math.hypot(dx, dy) },
      hipDisplacementM: distance3(feature.hipCenterWorld, this.input.calibration.hipCenterWorld),
      hipHeightDeltaNormalized: feature.hipCenterImage.y - this.input.calibration.hipHeightNormalized,
      torsoAngleDeltaDeg: feature.torsoAngleDeg - this.input.calibration.torsoAngleDeg,
      stanceWidthDeltaNormalized: feature.stanceWidthNormalized - this.input.calibration.stanceWidthNormalized,
      compositeVelocity,
      detectedDirection: this.detectedDirection,
    };
  }

  private directionFromMotion(expected: WrestlingDirection | null): WrestlingDirection | null {
    if (this.sprawlSignals() >= 2) return "SPRAWL";
    const { x, y } = this.latestMotion.bodyDisplacement;
    const dead = config.motion.directionDeadZoneNormalized;
    if (Math.abs(x) >= Math.abs(y) && Math.abs(x) >= dead) {
      if (expected === "CIRCLE_LEFT" || expected === "CIRCLE_RIGHT") return x < 0 ? "CIRCLE_LEFT" : "CIRCLE_RIGHT";
      return x < 0 ? "LEFT" : "RIGHT";
    }
    if (Math.abs(y) >= dead) return y < 0 ? "FORWARD" : "BACK";
    if (this.latestMotion.hipHeightDeltaNormalized > dead) return "LEVEL";
    return null;
  }

  private sprawlSignals(): number {
    return [
      this.latestMotion.hipDisplacementM >= config.motion.sprawlHipDisplacementM,
      Math.abs(this.latestMotion.hipHeightDeltaNormalized) >= config.motion.sprawlHipHeightDeltaNormalized,
      Math.abs(this.latestMotion.torsoAngleDeltaDeg) >= config.motion.sprawlTorsoAngleDeltaDeg,
      Math.abs(this.latestMotion.stanceWidthDeltaNormalized) >= config.motion.directionDeadZoneNormalized,
    ].filter(Boolean).length;
  }

  private isCorrectDirection(): boolean {
    const expected = normalizedDirection(requiredDirection(this.input.stimulus));
    const detected = normalizedDirection(this.detectedDirection);
    return expected === null || expected === detected;
  }

  private maybeTimeout(nowMs: number): WrestlingTrial | null {
    const limit = config.motion.trialTimeoutMs + (this.t2Ms === null ? 0 : config.recovery.timeoutMs);
    return nowMs - this.input.t0Ms >= limit ? this.forceTimeout(nowMs) : null;
  }

  private finishStance(timestampMs: number, stimulus: StanceStimulus): WrestlingTrial {
    const hip = medianAbsoluteDeviation(this.stanceFeatures.map((feature) => feature.hipCenterImage.y)) ?? 0;
    const torso = medianAbsoluteDeviation(this.stanceFeatures.map((feature) => feature.torsoAngleDeg)) ?? 0;
    const width = medianAbsoluteDeviation(this.stanceFeatures.map((feature) => feature.stanceWidthNormalized)) ?? 0;
    const center = medianAbsoluteDeviation(this.stanceFeatures.map((feature) => feature.bodyCenterImage.x)) ?? 0;
    const normalizedVariation = hip / config.calibration.maxHipHeightMadNormalized + torso / config.calibration.maxTorsoAngleMadDeg + width / config.calibration.maxStanceWidthMadNormalized + center / config.calibration.maxBodyCenterMadNormalized;
    const consistency = Math.max(0, Math.min(100, 100 - normalizedVariation * 12.5));
    if (consistency < 60) this.qualityFlags.add("STANCE_NOT_STABLE");
    const base = this.base("CORRECT", null, timestampMs, null);
    return { ...base, type: "stance", stimulus, hipHeightVariation: hip, torsoAngleVariation: torso, stanceWidthVariation: width, bodyCenterVariation: center, stanceConsistencyPct: Math.round(consistency * 10) / 10 };
  }

  private finish(outcome: WrestlingTrialOutcome, t1Ms: number | null, t2Ms: number | null, t3Ms: number | null): WrestlingTrial {
    const base = this.base(outcome, t1Ms, t2Ms, t3Ms);
    const stimulus = this.input.stimulus;
    if (stimulus.kind === "SHOT") return { ...base, type: "shot", stimulus, attack: stimulus.attack, responseDirection: this.detectedDirection };
    if (stimulus.kind === "SPRAWL") return { ...base, type: "sprawl", stimulus, attack: stimulus.attack, sprawlSignalsPassed: this.maxSprawlSignals, recovered: t3Ms !== null };
    if (stimulus.kind === "CHOICE") return { ...base, type: "choice", stimulus, attack: stimulus.attack, expectedResponse: stimulus.requiredDirection, detectedResponse: this.detectedDirection };
    if (stimulus.kind === "RECOGNITION") return { ...base, type: "recognition", stimulus, cue: stimulus.cue, classification: stimulus.cue === "FAKE" ? outcome === "FALSE_DEFENSE" ? "FALSE_DEFENSE" : "CORRECT_RESTRAINT" : outcome === "MISSED_DEFENSE" || outcome === "NO_RESPONSE" ? "MISSED_DEFENSE" : "CORRECT_DEFENSE" };
    if (stimulus.kind === "MOVEMENT") return { ...base, type: "movement", stimulus, command: stimulus.command, stanceHeightDeviation: Math.abs(this.latestMotion.hipHeightDeltaNormalized), centerDisplacement: this.latestMotion.bodyDisplacement.magnitude };
    if (stimulus.kind === "SCRAMBLE") return { ...base, type: "scramble", stimulus, command: stimulus.command, commandIndex: this.input.trialIndex };
    if (stimulus.kind === "STANCE") return this.finishStance(t2Ms ?? this.input.t0Ms + stimulus.durationMs, stimulus);
    throw new Error(`Unsupported wrestling stimulus in W1-W6 engine: ${stimulus.kind}`);
  }

  private base(outcome: WrestlingTrialOutcome, t1Ms: number | null, t2Ms: number | null, t3Ms: number | null): WrestlingTrialBase {
    const trackingQualityPct = this.totalFrames > 0 ? (this.usableFrames / this.totalFrames) * 100 : 0;
    const correct = outcome === "CORRECT";
    if (!correct && outcome === "WRONG_DIRECTION") this.qualityFlags.add("RESPONSE_DIRECTION_UNCLEAR");
    return {
      trialIndex: this.input.trialIndex,
      protocolId: this.input.protocolId,
      protocolVersion: WRESTLING_PROTOCOLS[this.input.protocolId].version,
      stimulus: this.input.stimulus,
      t0Ms: this.input.t0Ms,
      t1Ms,
      t2Ms,
      t3Ms,
      reactionTimeMs: t1Ms === null ? null : Math.max(0, t1Ms - this.input.t0Ms),
      executionTimeMs: t1Ms === null || t2Ms === null ? null : Math.max(0, t2Ms - t1Ms),
      totalResponseMs: t2Ms === null ? null : Math.max(0, t2Ms - this.input.t0Ms),
      recoveryToStanceMs: t2Ms === null || t3Ms === null ? null : Math.max(0, t3Ms - t2Ms),
      outcome,
      correct,
      motion: { ...this.latestMotion, detectedDirection: this.detectedDirection },
      trackingQualityPct: Math.round(trackingQualityPct * 10) / 10,
      qualityFlags: [...this.qualityFlags],
    };
  }
}
