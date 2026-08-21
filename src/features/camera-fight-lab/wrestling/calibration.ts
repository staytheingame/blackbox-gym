import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { median } from "../statistics";
import { distance3 } from "../vectorMath";
import { estimateSampleFps } from "../calibrationEngine";
import type { CameraSnapshot, PoseSample, Vec3 } from "../types";
import { extractWrestlingFeatures, featureMad, medianVec3, stanceHeightM } from "./features";
import type {
  WrestlingCalibrationEvaluation,
  WrestlingCalibrationIssueCode,
  WrestlingCalibrationSnapshot,
} from "./types";

const config = PERFORMANCE_CONFIG.wrestling.calibration;
const issue = (code: WrestlingCalibrationIssueCode, message: string) => ({ code, message });

const medianPoint = (samples: readonly PoseSample[], space: "image" | "world", key: keyof PoseSample["image"]): Vec3 | null =>
  medianVec3(samples.flatMap((sample) => {
    const point = sample[space][key];
    return point ? [point] : [];
  }));

const visibleRatio = (samples: readonly PoseSample[], keys: readonly (keyof PoseSample["visibility"])[]): number => {
  if (samples.length === 0) return 0;
  const visible = samples.filter((sample) => keys.every((key) => sample.visibility[key] >= config.minVisibility));
  return visible.length / samples.length;
};

export function evaluateWrestlingCalibration(
  allSamples: readonly PoseSample[],
  camera: CameraSnapshot,
  nowMs = allSamples.at(-1)?.timestampMs ?? 0,
): WrestlingCalibrationEvaluation {
  const samples = allSamples.filter((sample) => sample.timestampMs >= nowMs - config.stableWindowMs);
  if (samples.length === 0 || samples.every((sample) => sample.poseCount === 0)) {
    return { ready: false, progressPct: 0, issues: [issue("NO_PERSON", "Kadraja gir ve başından ayak bileklerine kadar görünür ol.")], snapshot: null, usableSampleCount: 0 };
  }
  const issues: WrestlingCalibrationEvaluation["issues"] = [];
  if (samples.some((sample) => sample.poseCount > 1)) issues.push(issue("MULTIPLE_PEOPLE", "Kalibrasyon alanında yalnızca bir kişi olmalı."));

  const checks = [
    { keys: ["leftShoulder", "rightShoulder"] as const, code: "SHOULDERS_MISSING" as const, message: "İki omzunu kameraya açık tut." },
    { keys: ["leftHip", "rightHip"] as const, code: "HIPS_MISSING" as const, message: "Kalçalarını kadraj içinde tut." },
    { keys: ["leftKnee", "rightKnee"] as const, code: "KNEES_MISSING" as const, message: "İki dizini de görünür tut." },
    { keys: ["leftAnkle", "rightAnkle"] as const, code: "ANKLES_MISSING" as const, message: "Mümkünse iki ayak bileğini de kadraja al." },
    { keys: ["leftWrist", "rightWrist"] as const, code: "WRISTS_MISSING" as const, message: "İki bileğini de kadraj içinde tut." },
  ];
  for (const check of checks) {
    if (visibleRatio(samples, check.keys) < config.lowerBodyVisibleRatio) issues.push(issue(check.code, check.message));
  }
  if (visibleRatio(samples, ["nose"]) < config.lowerBodyVisibleRatio) issues.push(issue("HEAD_OUT_OF_FRAME", "Başını kadraj içinde tut."));

  const usable = samples.filter((sample) => {
    if (sample.poseCount !== 1) return false;
    const features = extractWrestlingFeatures(sample);
    return features !== null && features.confidence >= config.minVisibility && sample.visibility.leftWrist >= config.minVisibility && sample.visibility.rightWrist >= config.minVisibility;
  });
  const features = usable.flatMap((sample) => {
    const feature = extractWrestlingFeatures(sample);
    return feature ? [feature] : [];
  });
  if (usable.length < Math.max(2, samples.length * config.lowerBodyVisibleRatio)) issues.push(issue("LOW_CONFIDENCE", "Işığı artır ve tüm vücudun görünürken stance pozisyonunda sabit kal."));

  const requiredKeys = ["leftShoulder", "rightShoulder", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle", "leftWrist", "rightWrist"] as const;
  const imagePoints = Object.fromEntries(requiredKeys.map((key) => [key, medianPoint(usable, "image", key)]));
  const worldPoints = Object.fromEntries(requiredKeys.map((key) => [key, medianPoint(usable, "world", key)]));
  if (features.length === 0 || Object.values(imagePoints).some((point) => !point) || Object.values(worldPoints).some((point) => !point)) {
    return { ready: false, progressPct: 0, issues: issues.length ? issues : [issue("LOW_CONFIDENCE", "Poz verisi henüz kararlı değil.")], snapshot: null, usableSampleCount: usable.length };
  }
  const typedImage = imagePoints as Record<(typeof requiredKeys)[number], Vec3>;
  const typedWorld = worldPoints as Record<(typeof requiredKeys)[number], Vec3>;
  const latestMedian = {
    shoulderCenterWorld: medianVec3(features.map((feature) => feature.shoulderCenterWorld))!,
    shoulderCenterImage: medianVec3(features.map((feature) => feature.shoulderCenterImage))!,
    hipCenterWorld: medianVec3(features.map((feature) => feature.hipCenterWorld))!,
    hipCenterImage: medianVec3(features.map((feature) => feature.hipCenterImage))!,
    bodyCenterWorld: medianVec3(features.map((feature) => feature.bodyCenterWorld))!,
    bodyCenterImage: medianVec3(features.map((feature) => feature.bodyCenterImage))!,
  };
  const ankleInside = typedImage.leftAnkle.y <= config.ankleBottomMargin && typedImage.rightAnkle.y <= config.ankleBottomMargin;
  const nose = medianPoint(usable, "image", "nose");
  if (!ankleInside) issues.push(issue("LOWER_BODY_OUT_OF_FRAME", "Ayak bileklerini kadrajın içine al veya kameradan uzaklaş."));
  if (nose && nose.y < config.headTopMargin) issues.push(issue("HEAD_OUT_OF_FRAME", "Başının üzerinde biraz kadraj boşluğu bırak."));
  const stanceWidthNormalized = distance3(typedImage.leftAnkle, typedImage.rightAnkle);
  if (stanceWidthNormalized < config.minStanceWidthNormalized) issues.push(issue("STANCE_TOO_NARROW", "Rahat ve kontrollü wrestling stance pozisyonuna geç."));

  const stability = featureMad(features);
  if (stability.hipHeight > config.maxHipHeightMadNormalized || stability.torsoAngle > config.maxTorsoAngleMadDeg || stability.stanceWidth > config.maxStanceWidthMadNormalized || stability.bodyCenter > config.maxBodyCenterMadNormalized) {
    issues.push(issue("STANCE_NOT_STABLE", "Wrestling stance pozisyonunda kısa süre sabit kal."));
  }

  const observedDuration = usable.length >= 2 ? usable.at(-1)!.timestampMs - usable[0].timestampMs : 0;
  const progressPct = Math.round(Math.min(observedDuration / config.stableWindowMs, usable.length / config.minimumSamples, 1) * 100);
  const enoughData = observedDuration >= config.stableWindowMs * 0.9 && usable.length >= config.minimumSamples;
  const ready = enoughData && issues.length === 0;
  const leftLeadDelta = typedWorld.leftAnkle.z - typedWorld.rightAnkle.z;
  const footLeadRelationship = Math.abs(leftLeadDelta) < 0.035 ? "square" : leftLeadDelta < 0 ? "left-lead" : "right-lead";
  const snapshot: WrestlingCalibrationSnapshot | null = ready ? {
    kind: "wrestling",
    sport: "wrestling",
    completedAt: nowMs,
    shoulderWidthM: distance3(typedWorld.leftShoulder, typedWorld.rightShoulder),
    shoulderWidthNormalized: distance3(typedImage.leftShoulder, typedImage.rightShoulder),
    hipWidthM: distance3(typedWorld.leftHip, typedWorld.rightHip),
    hipWidthNormalized: distance3(typedImage.leftHip, typedImage.rightHip),
    stanceHeightM: median(features.map(stanceHeightM)) ?? 0,
    torsoCenterWorld: latestMedian.shoulderCenterWorld,
    torsoCenterImage: latestMedian.shoulderCenterImage,
    hipCenterWorld: latestMedian.hipCenterWorld,
    hipCenterImage: latestMedian.hipCenterImage,
    leftKneeBaselineWorld: typedWorld.leftKnee,
    rightKneeBaselineWorld: typedWorld.rightKnee,
    leftKneeBaselineImage: typedImage.leftKnee,
    rightKneeBaselineImage: typedImage.rightKnee,
    leftAnkleBaselineWorld: typedWorld.leftAnkle,
    rightAnkleBaselineWorld: typedWorld.rightAnkle,
    leftAnkleBaselineImage: typedImage.leftAnkle,
    rightAnkleBaselineImage: typedImage.rightAnkle,
    leftWristBaselineWorld: typedWorld.leftWrist,
    rightWristBaselineWorld: typedWorld.rightWrist,
    leftWristBaselineImage: typedImage.leftWrist,
    rightWristBaselineImage: typedImage.rightWrist,
    stanceWidthM: median(features.map((feature) => feature.stanceWidthM)) ?? 0,
    stanceWidthNormalized: median(features.map((feature) => feature.stanceWidthNormalized)) ?? 0,
    bodyCenterWorld: latestMedian.bodyCenterWorld,
    bodyCenterImage: latestMedian.bodyCenterImage,
    hipHeightNormalized: latestMedian.hipCenterImage.y,
    torsoAngleDeg: median(features.map((feature) => feature.torsoAngleDeg)) ?? 0,
    leftKneeFlexionProxyDeg: median(features.map((feature) => feature.leftKneeFlexionProxyDeg)) ?? 0,
    rightKneeFlexionProxyDeg: median(features.map((feature) => feature.rightKneeFlexionProxyDeg)) ?? 0,
    footLeadRelationship,
    stability: {
      hipHeightMadNormalized: stability.hipHeight,
      torsoAngleMadDeg: stability.torsoAngle,
      stanceWidthMadNormalized: stability.stanceWidth,
      bodyCenterMadNormalized: stability.bodyCenter,
    },
    camera,
    estimatedProcessingFps: estimateSampleFps(usable),
  } : null;
  return { ready, progressPct, issues, snapshot, usableSampleCount: usable.length };
}
