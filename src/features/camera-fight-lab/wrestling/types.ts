import type { CameraSnapshot, PoseSample, Vec3 } from "../types";

export type WrestlingCalibrationSnapshot = {
  kind: "wrestling";
  sport: "wrestling";
  completedAt: number;
  shoulderWidthM: number;
  shoulderWidthNormalized: number;
  hipWidthM: number;
  hipWidthNormalized: number;
  stanceHeightM: number;
  torsoCenterWorld: Vec3;
  torsoCenterImage: Vec3;
  hipCenterWorld: Vec3;
  hipCenterImage: Vec3;
  leftKneeBaselineWorld: Vec3;
  rightKneeBaselineWorld: Vec3;
  leftKneeBaselineImage: Vec3;
  rightKneeBaselineImage: Vec3;
  leftAnkleBaselineWorld: Vec3;
  rightAnkleBaselineWorld: Vec3;
  leftAnkleBaselineImage: Vec3;
  rightAnkleBaselineImage: Vec3;
  leftWristBaselineWorld: Vec3;
  rightWristBaselineWorld: Vec3;
  leftWristBaselineImage: Vec3;
  rightWristBaselineImage: Vec3;
  stanceWidthM: number;
  stanceWidthNormalized: number;
  bodyCenterWorld: Vec3;
  bodyCenterImage: Vec3;
  hipHeightNormalized: number;
  torsoAngleDeg: number;
  leftKneeFlexionProxyDeg: number;
  rightKneeFlexionProxyDeg: number;
  footLeadRelationship: "left-lead" | "right-lead" | "square" | "unclear";
  stability: {
    hipHeightMadNormalized: number;
    torsoAngleMadDeg: number;
    stanceWidthMadNormalized: number;
    bodyCenterMadNormalized: number;
  };
  camera: CameraSnapshot;
  estimatedProcessingFps: number;
};

export type WrestlingPoseFeatures = {
  timestampMs: number;
  shoulderCenterWorld: Vec3;
  shoulderCenterImage: Vec3;
  hipCenterWorld: Vec3;
  hipCenterImage: Vec3;
  kneeCenterWorld: Vec3;
  kneeCenterImage: Vec3;
  ankleCenterWorld: Vec3;
  ankleCenterImage: Vec3;
  bodyCenterWorld: Vec3;
  bodyCenterImage: Vec3;
  torsoAngleDeg: number;
  leftKneeFlexionProxyDeg: number;
  rightKneeFlexionProxyDeg: number;
  stanceWidthM: number;
  stanceWidthNormalized: number;
  confidence: number;
};

export type WrestlingCalibrationIssueCode =
  | "NO_PERSON"
  | "MULTIPLE_PEOPLE"
  | "HEAD_OUT_OF_FRAME"
  | "SHOULDERS_MISSING"
  | "HIPS_MISSING"
  | "KNEES_MISSING"
  | "ANKLES_MISSING"
  | "WRISTS_MISSING"
  | "LOWER_BODY_OUT_OF_FRAME"
  | "STANCE_TOO_NARROW"
  | "LOW_CONFIDENCE"
  | "STANCE_NOT_STABLE";

export type WrestlingCalibrationEvaluation = {
  ready: boolean;
  progressPct: number;
  issues: Array<{ code: WrestlingCalibrationIssueCode; message: string }>;
  snapshot: WrestlingCalibrationSnapshot | null;
  usableSampleCount: number;
};

export type WrestlingSampleSequence = readonly PoseSample[];
