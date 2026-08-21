import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { median } from "./statistics";
import { distance3, midpoint3 } from "./vectorMath";
import { velocityMps } from "./velocity";
import type {
  CalibrationSnapshot,
  CameraSnapshot,
  PoseSample,
  Vec3,
} from "./types";

export type CalibrationIssueCode =
  | "NO_PERSON"
  | "MULTIPLE_PEOPLE"
  | "SHOULDERS_MISSING"
  | "WRISTS_MISSING"
  | "HEAD_MISSING"
  | "MOVE_BACK"
  | "BODY_OUT_OF_FRAME"
  | "LOW_CONFIDENCE"
  | "RAISE_GUARD"
  | "HOLD_STILL";

export type CalibrationIssue = { code: CalibrationIssueCode; message: string };

export type CalibrationEvaluation = {
  ready: boolean;
  progressPct: number;
  issues: CalibrationIssue[];
  snapshot: CalibrationSnapshot | null;
  usableSampleCount: number;
};

const issue = (code: CalibrationIssueCode, message: string): CalibrationIssue => ({
  code,
  message,
});

const medianVec3 = (values: readonly Vec3[]): Vec3 | null => {
  const x = median(values.map((value) => value.x));
  const y = median(values.map((value) => value.y));
  const z = median(values.map((value) => value.z));
  return x === null || y === null || z === null ? null : { x, y, z };
};

const medianDistanceFrom = (values: readonly Vec3[], center: Vec3): number =>
  median(values.map((value) => distance3(value, center))) ?? Number.POSITIVE_INFINITY;

export function estimateSampleFps(samples: readonly PoseSample[]): number {
  if (samples.length < 2) return 0;
  const duration = samples[samples.length - 1].timestampMs - samples[0].timestampMs;
  return duration > 0 ? ((samples.length - 1) * 1_000) / duration : 0;
}

export function evaluateCalibration(
  allSamples: readonly PoseSample[],
  camera: CameraSnapshot,
  nowMs = allSamples.at(-1)?.timestampMs ?? 0,
): CalibrationEvaluation {
  const cutoff = nowMs - PERFORMANCE_CONFIG.calibration.stableWindowMs;
  const samples = allSamples.filter((sample) => sample.timestampMs >= cutoff);
  const issues: CalibrationIssue[] = [];

  if (samples.length === 0 || samples.every((sample) => sample.poseCount === 0)) {
    return {
      ready: false,
      progressPct: 0,
      issues: [issue("NO_PERSON", "Kadraja gir ve üst gövdeni görünür tut.")],
      snapshot: null,
      usableSampleCount: 0,
    };
  }
  if (samples.some((sample) => sample.poseCount > PERFORMANCE_CONFIG.calibration.maxPoseCount)) {
    issues.push(issue("MULTIPLE_PEOPLE", "Kalibrasyon alanında yalnızca bir kişi olmalı."));
  }

  const minVisibility = PERFORMANCE_CONFIG.pose.minVisibility;
  const usable = samples.filter((sample) => {
    const visible = sample.visibility;
    return (
      sample.poseCount === 1 &&
      visible.leftShoulder >= minVisibility &&
      visible.rightShoulder >= minVisibility &&
      visible.leftWrist >= minVisibility &&
      visible.rightWrist >= minVisibility &&
      visible.nose >= minVisibility &&
      !!sample.world.leftShoulder &&
      !!sample.world.rightShoulder &&
      !!sample.world.leftWrist &&
      !!sample.world.rightWrist &&
      !!sample.world.nose &&
      !!sample.image.leftShoulder &&
      !!sample.image.rightShoulder &&
      !!sample.image.leftWrist &&
      !!sample.image.rightWrist &&
      !!sample.image.nose
    );
  });

  const shoulderVisibleCount = samples.filter(
    (sample) =>
      sample.visibility.leftShoulder >= minVisibility &&
      sample.visibility.rightShoulder >= minVisibility,
  ).length;
  const wristVisibleCount = samples.filter(
    (sample) =>
      sample.visibility.leftWrist >= minVisibility && sample.visibility.rightWrist >= minVisibility,
  ).length;
  const headVisibleCount = samples.filter(
    (sample) => sample.visibility.nose >= minVisibility,
  ).length;
  if (shoulderVisibleCount < samples.length * 0.85) {
    issues.push(issue("SHOULDERS_MISSING", "İki omzunu da kameraya açık tut."));
  }
  if (wristVisibleCount < samples.length * 0.85) {
    issues.push(issue("WRISTS_MISSING", "İki bileğini de kadraj içinde tut."));
  }
  if (headVisibleCount < samples.length * 0.85) {
    issues.push(issue("HEAD_MISSING", "Yüzünü ve başını kadrajda tut."));
  }
  if (usable.length < Math.max(2, samples.length * 0.8)) {
    issues.push(issue("LOW_CONFIDENCE", "Işığı artır ve eklemler görünürken sabit kal."));
  }

  const leftShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.leftShoulder ? [sample.image.leftShoulder] : [])),
  );
  const rightShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.rightShoulder ? [sample.image.rightShoulder] : [])),
  );
  const leftWristImage = medianVec3(
    usable.flatMap((sample) => (sample.image.leftWrist ? [sample.image.leftWrist] : [])),
  );
  const rightWristImage = medianVec3(
    usable.flatMap((sample) => (sample.image.rightWrist ? [sample.image.rightWrist] : [])),
  );
  const leftShoulderWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.leftShoulder ? [sample.world.leftShoulder] : [])),
  );
  const rightShoulderWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.rightShoulder ? [sample.world.rightShoulder] : [])),
  );
  const leftGuardWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.leftWrist ? [sample.world.leftWrist] : [])),
  );
  const rightGuardWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.rightWrist ? [sample.world.rightWrist] : [])),
  );
  const headNeutralWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.nose ? [sample.world.nose] : [])),
  );
  const headNeutralImage = medianVec3(
    usable.flatMap((sample) => (sample.image.nose ? [sample.image.nose] : [])),
  );

  if (
    !leftShoulderImage ||
    !rightShoulderImage ||
    !leftWristImage ||
    !rightWristImage ||
    !leftShoulderWorld ||
    !rightShoulderWorld ||
    !leftGuardWorld ||
    !rightGuardWorld ||
    !headNeutralWorld ||
    !headNeutralImage
  ) {
    return {
      ready: false,
      progressPct: 0,
      issues: issues.length > 0 ? issues : [issue("LOW_CONFIDENCE", "Poz verisi henüz kararlı değil.")],
      snapshot: null,
      usableSampleCount: usable.length,
    };
  }

  const shoulderWidthNormalized = Math.abs(leftShoulderImage.x - rightShoulderImage.x);
  if (shoulderWidthNormalized < PERFORMANCE_CONFIG.calibration.minShoulderWidthNormalized) {
    issues.push(issue("MOVE_BACK", "Üst gövde ve yumruk alanı için kameradan biraz uzaklaş."));
  }
  if (shoulderWidthNormalized > PERFORMANCE_CONFIG.calibration.maxShoulderWidthNormalized) {
    issues.push(issue("MOVE_BACK", "Kadraja daha fazla alan sığması için kameradan uzaklaş."));
  }

  const wristMargin = PERFORMANCE_CONFIG.calibration.wristFrameMargin;
  const wristsInFrame = [leftWristImage, rightWristImage].every(
    (point) =>
      point.x >= wristMargin &&
      point.x <= 1 - wristMargin &&
      point.y >= wristMargin &&
      point.y <= 1 - wristMargin,
  );
  const shouldersInFrame = [leftShoulderImage, rightShoulderImage].every(
    (point) =>
      point.y >= PERFORMANCE_CONFIG.calibration.shoulderTopMargin &&
      point.y <= PERFORMANCE_CONFIG.calibration.shoulderBottomLimit,
  );
  if (!wristsInFrame || !shouldersInFrame) {
    issues.push(issue("BODY_OUT_OF_FRAME", "Omuzlarını, ellerini ve yumruk alanını kadrajda tut."));
  }

  const shoulderCenterImage = midpoint3(leftShoulderImage, rightShoulderImage);
  const guardAllowance =
    shoulderCenterImage.y +
    PERFORMANCE_CONFIG.calibration.guardWristBelowShoulderAllowanceNormalized;
  const horizontalReach =
    shoulderWidthNormalized *
    PERFORMANCE_CONFIG.calibration.guardWristHorizontalReachShoulderWidths;
  const guardHeld =
    leftWristImage.y <= guardAllowance &&
    rightWristImage.y <= guardAllowance &&
    Math.abs(leftWristImage.x - shoulderCenterImage.x) <= horizontalReach &&
    Math.abs(rightWristImage.x - shoulderCenterImage.x) <= horizontalReach;
  if (!guardHeld) {
    issues.push(issue("RAISE_GUARD", "İki elini de temel guard pozisyonuna kaldır."));
  }

  const leftWorldValues = usable.flatMap((sample) =>
    sample.world.leftWrist ? [sample.world.leftWrist] : [],
  );
  const rightWorldValues = usable.flatMap((sample) =>
    sample.world.rightWrist ? [sample.world.rightWrist] : [],
  );
  const leftNoise = medianDistanceFrom(leftWorldValues, leftGuardWorld);
  const rightNoise = medianDistanceFrom(rightWorldValues, rightGuardWorld);
  const velocities = usable.slice(1).flatMap((sample, index) => {
    const previous = usable[index];
    const deltaMs = sample.timestampMs - previous.timestampMs;
    if (!sample.world.leftWrist || !previous.world.leftWrist || !sample.world.rightWrist || !previous.world.rightWrist) {
      return [];
    }
    return [
      velocityMps(previous.world.leftWrist, sample.world.leftWrist, deltaMs),
      velocityMps(previous.world.rightWrist, sample.world.rightWrist, deltaMs),
    ];
  });
  const medianVelocity = median(velocities) ?? Number.POSITIVE_INFINITY;
  if (
    leftNoise > PERFORMANCE_CONFIG.calibration.maxWristNoiseM ||
    rightNoise > PERFORMANCE_CONFIG.calibration.maxWristNoiseM ||
    medianVelocity > PERFORMANCE_CONFIG.calibration.maxMedianWristVelocityMps
  ) {
    issues.push(issue("HOLD_STILL", "Guard'da kısa süre sabit kal."));
  }

  const observedDuration =
    usable.length >= 2 ? usable[usable.length - 1].timestampMs - usable[0].timestampMs : 0;
  const durationProgress =
    observedDuration / PERFORMANCE_CONFIG.calibration.stableWindowMs;
  const sampleProgress =
    usable.length / PERFORMANCE_CONFIG.calibration.minimumSamples;
  const progressPct = Math.round(Math.min(durationProgress, sampleProgress, 1) * 100);
  const enoughData =
    observedDuration >= PERFORMANCE_CONFIG.calibration.stableWindowMs * 0.9 &&
    usable.length >= PERFORMANCE_CONFIG.calibration.minimumSamples;
  const ready = enoughData && issues.length === 0;

  const snapshot: CalibrationSnapshot | null = ready
    ? {
        completedAt: nowMs,
        shoulderWidthM: distance3(leftShoulderWorld, rightShoulderWorld),
        shoulderWidthNormalized,
        leftShoulderWorld,
        rightShoulderWorld,
        leftShoulderImage,
        rightShoulderImage,
        leftGuardWorld,
        rightGuardWorld,
        leftGuardImage: leftWristImage,
        rightGuardImage: rightWristImage,
        torsoCenterWorld: midpoint3(leftShoulderWorld, rightShoulderWorld),
        torsoCenterImage: shoulderCenterImage,
        headNeutralWorld,
        headNeutralImage,
        leftWristNoiseM: leftNoise,
        rightWristNoiseM: rightNoise,
        camera,
        estimatedProcessingFps: estimateSampleFps(usable),
      }
    : null;

  return { ready, progressPct, issues, snapshot, usableSampleCount: usable.length };
}

