import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import type { WristHistoryPoint } from "./types";

export type OnsetUpdate = {
  detected: boolean;
  t1Ms: number | null;
  candidateFrames: number;
};

/**
 * Onset tespiti için gereken minimum alan kümesi. `WristObservation` ve
 * `HeadObservation` bu şekli sağladığı için detector her ikisiyle de
 * (yumruk/guard veya baş/nötr pozisyon) kullanılabilir.
 */
export type OnsetObservation = {
  timestampMs: number;
  confidence: number;
  frameGap: boolean;
  landmarkJump: boolean;
  velocityMps: number;
  displacementFromGuardM: number;
  displacementDeltaM: number;
};

export type OnsetThresholds = {
  onsetVelocityMps: number;
  onsetExitVelocityMps: number;
  strongOnsetVelocityMps: number;
  minimumOnsetDisplacementM: number;
  onsetConsecutiveFrames: number;
};

const DEFAULT_THRESHOLDS: OnsetThresholds = {
  onsetVelocityMps: PERFORMANCE_CONFIG.motion.onsetVelocityMps,
  onsetExitVelocityMps: PERFORMANCE_CONFIG.motion.onsetExitVelocityMps,
  strongOnsetVelocityMps: PERFORMANCE_CONFIG.motion.strongOnsetVelocityMps,
  minimumOnsetDisplacementM: PERFORMANCE_CONFIG.motion.minimumOnsetDisplacementM,
  onsetConsecutiveFrames: PERFORMANCE_CONFIG.motion.onsetConsecutiveFrames,
};

/** Çok-kare doğrulaması ve güçlü-eşik kısa yolu kullanan gözlenebilir onset detector. */
export class OnsetDetector {
  private candidateStartMs: number | null = null;
  private candidateFrames = 0;
  private detectedAtMs: number | null = null;
  private readonly thresholds: OnsetThresholds;

  constructor(thresholds: OnsetThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  update(observation: OnsetObservation, t0Ms: number): OnsetUpdate {
    if (this.detectedAtMs !== null) {
      return { detected: true, t1Ms: this.detectedAtMs, candidateFrames: this.candidateFrames };
    }

    if (
      observation.timestampMs < t0Ms ||
      observation.confidence < PERFORMANCE_CONFIG.pose.minVisibility ||
      observation.frameGap ||
      observation.landmarkJump
    ) {
      this.clearCandidate();
      return { detected: false, t1Ms: null, candidateFrames: 0 };
    }

    const aboveEntry =
      observation.velocityMps >= this.thresholds.onsetVelocityMps &&
      observation.displacementFromGuardM >= this.thresholds.minimumOnsetDisplacementM &&
      observation.displacementDeltaM >= 0;

    if (aboveEntry) {
      if (this.candidateStartMs === null) this.candidateStartMs = observation.timestampMs;
      this.candidateFrames += 1;
      const confirmed =
        this.candidateFrames >= this.thresholds.onsetConsecutiveFrames ||
        observation.velocityMps >= this.thresholds.strongOnsetVelocityMps;
      if (confirmed) this.detectedAtMs = this.candidateStartMs;
    } else if (observation.velocityMps <= this.thresholds.onsetExitVelocityMps) {
      this.clearCandidate();
    }

    return {
      detected: this.detectedAtMs !== null,
      t1Ms: this.detectedAtMs,
      candidateFrames: this.candidateFrames,
    };
  }

  reset(): void {
    this.detectedAtMs = null;
    this.clearCandidate();
  }

  private clearCandidate(): void {
    this.candidateStartMs = null;
    this.candidateFrames = 0;
  }
}

export function hasPrematureMovement(
  history: readonly WristHistoryPoint[],
  t0Ms: number,
): boolean {
  const fromMs = t0Ms - PERFORMANCE_CONFIG.motion.prematureWindowMs;
  let consecutive = 0;
  for (const point of history) {
    if (point.timestampMs < fromMs || point.timestampMs >= t0Ms) continue;
    if (
      !point.frameGap &&
      !point.landmarkJump &&
      point.confidence >= PERFORMANCE_CONFIG.pose.minVisibility &&
      point.velocityMps >= PERFORMANCE_CONFIG.motion.prematureVelocityMps &&
      point.displacementFromGuardM >= PERFORMANCE_CONFIG.motion.minimumOnsetDisplacementM
    ) {
      consecutive += 1;
      if (consecutive >= PERFORMANCE_CONFIG.motion.onsetConsecutiveFrames) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}
