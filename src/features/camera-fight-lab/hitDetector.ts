import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { cosineSimilarity2, distance2, subtract2 } from "./vectorMath";
import type { QualityFlag, TargetSnapshot, WristObservation } from "./types";

export type HitCheckInput = {
  targetActive: boolean;
  trialCompleted: boolean;
  observation: WristObservation;
  target: TargetSnapshot;
  t1Ms: number | null;
  wasOutsideTarget: boolean;
};

export type HitCheckResult = {
  accepted: boolean;
  insideTarget: boolean;
  reason: QualityFlag | null;
  directionCosine: number;
};

export function isInsideTarget(
  point: { x: number; y: number },
  target: TargetSnapshot,
): boolean {
  return (
    distance2(point, { x: target.displayX, y: target.displayY }) <=
    target.radiusPx + PERFORMANCE_CONFIG.hit.wristTolerancePx
  );
}

export function checkHit(input: HitCheckInput): HitCheckResult {
  const { observation, target } = input;
  const insideTarget = isInsideTarget(observation.display, target);

  if (!input.targetActive || input.trialCompleted || !insideTarget) {
    return { accepted: false, insideTarget, reason: null, directionCosine: 0 };
  }
  if (!input.wasOutsideTarget) {
    return {
      accepted: false,
      insideTarget,
      reason: "HAND_ALREADY_IN_TARGET",
      directionCosine: 0,
    };
  }
  if (
    observation.confidence < PERFORMANCE_CONFIG.pose.minVisibility ||
    observation.frameGap ||
    observation.landmarkJump
  ) {
    return {
      accepted: false,
      insideTarget,
      reason: "LOW_TRACKING_CONFIDENCE",
      directionCosine: 0,
    };
  }
  if (input.t1Ms === null) {
    return { accepted: false, insideTarget, reason: "NO_ONSET_DETECTED", directionCosine: 0 };
  }
  if (observation.velocityMps < PERFORMANCE_CONFIG.hit.minimumVelocityMps) {
    return { accepted: false, insideTarget, reason: "INVALID_HIT_SPEED", directionCosine: 0 };
  }

  const previous = observation.previousDisplay;
  if (!previous) {
    return {
      accepted: false,
      insideTarget,
      reason: "INVALID_HIT_DIRECTION",
      directionCosine: 0,
    };
  }
  const movement = subtract2(observation.display, previous);
  const towardTarget = subtract2(
    { x: target.displayX, y: target.displayY },
    previous,
  );
  const directionCosine = cosineSimilarity2(movement, towardTarget);
  if (directionCosine < PERFORMANCE_CONFIG.hit.minimumDirectionCosine) {
    return {
      accepted: false,
      insideTarget,
      reason: "INVALID_HIT_DIRECTION",
      directionCosine,
    };
  }

  return { accepted: true, insideTarget, reason: null, directionCosine };
}

