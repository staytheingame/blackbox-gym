import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { imageToDisplayCanvas, type CanvasSize } from "../coordinates";
import { GuardReturnTracker } from "../guardReturnEngine";
import { checkHit, isInsideTarget } from "../hitDetector";
import { OnsetDetector } from "../onsetDetector";
import type { Hand, TargetSnapshot, WristObservation } from "../types";
import type { HandFightingStimulus, HandFightingTrial, WrestlingMotionSnapshot, WrestlingProtocolId, WrestlingQualityFlag } from "./protocolTypes";
import type { WrestlingCalibrationSnapshot } from "./types";

const emptyMotion = (): WrestlingMotionSnapshot => ({ bodyDisplacement: { x: 0, y: 0, magnitude: 0 }, hipDisplacementM: 0, hipHeightDeltaNormalized: 0, torsoAngleDeltaDeg: 0, stanceWidthDeltaNormalized: 0, compositeVelocity: 0, detectedDirection: null });

export function createHandFightingTarget(calibration: WrestlingCalibrationSnapshot, canvas: CanvasSize, stimulus: HandFightingStimulus): TargetSnapshot {
  const point = stimulus.target === "LEFT_WRIST" ? calibration.leftWristBaselineImage : stimulus.target === "RIGHT_WRIST" ? calibration.rightWristBaselineImage : calibration.torsoCenterImage;
  const offsetY = stimulus.target === "COLLAR_TIE" ? -calibration.shoulderWidthNormalized * 0.65 : stimulus.target === "INSIDE_CONTROL" ? calibration.shoulderWidthNormalized * 0.15 : 0;
  const display = imageToDisplayCanvas({ x: point.x, y: point.y + offsetY }, canvas);
  const radiusNormalized = Math.max(0.052, Math.min(0.085, calibration.shoulderWidthNormalized * PERFORMANCE_CONFIG.target.radiusShoulderRatio));
  return { displayX: display.x, displayY: display.y, normalizedX: display.x / canvas.width, normalizedY: display.y / canvas.height, radiusPx: radiusNormalized * canvas.width, radiusNormalized, canvasWidth: canvas.width, canvasHeight: canvas.height, zoneIndex: 0 };
}

export class HandFightingEngine {
  private readonly onset = { left: new OnsetDetector(), right: new OnsetDetector() };
  private readonly wasOutside = { left: true, right: true };
  private returnTracker: GuardReturnTracker | null = null;
  private hitHand: Hand | null = null;
  private t1Ms: number | null = null;
  private t2Ms: number | null = null;
  private flags = new Set<WrestlingQualityFlag>();
  private result: HandFightingTrial | null = null;
  private totalFrames = 0;
  private usableFrames = 0;

  constructor(
    private readonly trialIndex: number,
    private readonly protocolId: WrestlingProtocolId,
    private readonly stimulus: HandFightingStimulus,
    private readonly calibration: WrestlingCalibrationSnapshot,
    private readonly target: TargetSnapshot,
    private readonly t0Ms: number,
  ) {}

  update(observations: Record<Hand, WristObservation | null>): HandFightingTrial | null {
    if (this.result) return this.result;
    this.totalFrames += 1;
    if (observations.left || observations.right) this.usableFrames += 1;
    if (this.t2Ms === null) {
      for (const hand of ["left", "right"] as const) {
        const observation = observations[hand];
        if (!observation) continue;
        const onset = this.onset[hand].update(observation, this.t0Ms);
        if (!isInsideTarget(observation.display, this.target)) this.wasOutside[hand] = true;
        const hit = checkHit({ targetActive: true, trialCompleted: false, observation, target: this.target, t1Ms: onset.t1Ms, wasOutsideTarget: this.wasOutside[hand] });
        if (!hit.accepted) continue;
        this.t1Ms = onset.t1Ms;
        this.t2Ms = observation.timestampMs;
        this.hitHand = hand;
        this.returnTracker = new GuardReturnTracker(hand, this.t2Ms, PERFORMANCE_CONFIG.wrestling.recovery.stableFrames, PERFORMANCE_CONFIG.wrestling.recovery.timeoutMs);
        if (this.stimulus.requiredHand !== "either" && this.stimulus.requiredHand !== hand) {
          this.flags.add("RESPONSE_DIRECTION_UNCLEAR");
        }
        break;
      }
    }
    if (this.t2Ms !== null && this.hitHand && this.returnTracker) {
      const observation = observations[this.hitHand];
      if (observation) {
        const guardImage = this.hitHand === "left" ? this.calibration.leftWristBaselineImage : this.calibration.rightWristBaselineImage;
        const guardPoint = imageToDisplayCanvas(guardImage, { width: this.target.canvasWidth, height: this.target.canvasHeight });
        const returned = this.returnTracker.update(observation, guardPoint, this.target.radiusPx * 0.8);
        if (returned) this.result = this.finish(returned.t3Ms, returned.returnTimeMs);
      }
    }
    return this.result;
  }

  forceTimeout(): HandFightingTrial {
    if (this.result) return this.result;
    this.flags.add("TRIAL_TIMEOUT");
    const returned = this.returnTracker?.forceResolve();
    this.result = this.finish(returned?.t3Ms ?? null, returned?.returnTimeMs ?? null);
    return this.result;
  }

  private finish(t3Ms: number | null, returnTimeMs: number | null): HandFightingTrial {
    const correctHand = this.hitHand !== null && (this.stimulus.requiredHand === "either" || this.stimulus.requiredHand === this.hitHand);
    if (this.t2Ms !== null && t3Ms === null) this.flags.add("RECOVERY_NOT_DETECTED");
    const outcome = this.t2Ms === null ? "NO_RESPONSE" : correctHand ? "CORRECT" : "WRONG_DIRECTION";
    return {
      trialIndex: this.trialIndex, protocolId: this.protocolId, protocolVersion: "1.0.0", stimulus: this.stimulus,
      t0Ms: this.t0Ms, t1Ms: this.t1Ms, t2Ms: this.t2Ms, t3Ms,
      reactionTimeMs: this.t1Ms === null ? null : this.t1Ms - this.t0Ms,
      executionTimeMs: this.t1Ms === null || this.t2Ms === null ? null : this.t2Ms - this.t1Ms,
      totalResponseMs: this.t2Ms === null ? null : this.t2Ms - this.t0Ms,
      recoveryToStanceMs: returnTimeMs,
      outcome, correct: outcome === "CORRECT", motion: emptyMotion(),
      trackingQualityPct: this.totalFrames ? Math.round((this.usableFrames / this.totalFrames) * 1000) / 10 : 0,
      qualityFlags: [...this.flags], type: "hand-fighting", target: this.stimulus.target,
      requiredHand: this.stimulus.requiredHand, detectedHand: this.hitHand,
      contactTimeMs: this.t2Ms === null ? null : this.t2Ms - this.t0Ms,
      returnTimeMs,
    };
  }
}
