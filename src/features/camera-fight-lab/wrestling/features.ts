import { mean, median, medianAbsoluteDeviation } from "../statistics";
import { distance2, distance3, midpoint3 } from "../vectorMath";
import type { PoseSample, Vec3 } from "../types";
import type { WrestlingPoseFeatures } from "./types";

const average3 = (...points: readonly Vec3[]): Vec3 => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
});

const angleAt = (a: Vec3, vertex: Vec3, c: Vec3): number => {
  const av = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const cv = { x: c.x - vertex.x, y: c.y - vertex.y, z: c.z - vertex.z };
  const denominator = Math.hypot(av.x, av.y, av.z) * Math.hypot(cv.x, cv.y, cv.z);
  if (denominator <= Number.EPSILON) return 0;
  const cosine = Math.max(-1, Math.min(1, (av.x * cv.x + av.y * cv.y + av.z * cv.z) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
};

export const torsoAngleDeg = (shoulderCenter: Vec3, hipCenter: Vec3): number => {
  const dx = shoulderCenter.x - hipCenter.x;
  const dy = shoulderCenter.y - hipCenter.y;
  return (Math.atan2(Math.abs(dx), Math.max(Math.abs(dy), Number.EPSILON)) * 180) / Math.PI;
};

export function extractWrestlingFeatures(sample: PoseSample): WrestlingPoseFeatures | null {
  const image = sample.image;
  const world = sample.world;
  const requiredImage = [
    image.leftShoulder,
    image.rightShoulder,
    image.leftHip,
    image.rightHip,
    image.leftKnee,
    image.rightKnee,
    image.leftAnkle,
    image.rightAnkle,
  ];
  const requiredWorld = [
    world.leftShoulder,
    world.rightShoulder,
    world.leftHip,
    world.rightHip,
    world.leftKnee,
    world.rightKnee,
    world.leftAnkle,
    world.rightAnkle,
  ];
  if (requiredImage.some((point) => !point) || requiredWorld.some((point) => !point)) return null;

  const [leftShoulderI, rightShoulderI, leftHipI, rightHipI, leftKneeI, rightKneeI, leftAnkleI, rightAnkleI] = requiredImage as Vec3[];
  const [leftShoulderW, rightShoulderW, leftHipW, rightHipW, leftKneeW, rightKneeW, leftAnkleW, rightAnkleW] = requiredWorld as Vec3[];
  const shoulderCenterImage = midpoint3(leftShoulderI, rightShoulderI);
  const shoulderCenterWorld = midpoint3(leftShoulderW, rightShoulderW);
  const hipCenterImage = midpoint3(leftHipI, rightHipI);
  const hipCenterWorld = midpoint3(leftHipW, rightHipW);
  const kneeCenterImage = midpoint3(leftKneeI, rightKneeI);
  const kneeCenterWorld = midpoint3(leftKneeW, rightKneeW);
  const ankleCenterImage = midpoint3(leftAnkleI, rightAnkleI);
  const ankleCenterWorld = midpoint3(leftAnkleW, rightAnkleW);
  const visibilityKeys = [
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ] as const;

  return {
    timestampMs: sample.timestampMs,
    shoulderCenterWorld,
    shoulderCenterImage,
    hipCenterWorld,
    hipCenterImage,
    kneeCenterWorld,
    kneeCenterImage,
    ankleCenterWorld,
    ankleCenterImage,
    bodyCenterWorld: average3(shoulderCenterWorld, hipCenterWorld, kneeCenterWorld),
    bodyCenterImage: average3(shoulderCenterImage, hipCenterImage, kneeCenterImage),
    torsoAngleDeg: torsoAngleDeg(shoulderCenterImage, hipCenterImage),
    leftKneeFlexionProxyDeg: angleAt(leftHipW, leftKneeW, leftAnkleW),
    rightKneeFlexionProxyDeg: angleAt(rightHipW, rightKneeW, rightAnkleW),
    stanceWidthM: distance3(leftAnkleW, rightAnkleW),
    stanceWidthNormalized: distance2(leftAnkleI, rightAnkleI),
    confidence: mean(visibilityKeys.map((key) => sample.visibility[key])) ?? 0,
  };
}

export const medianVec3 = (values: readonly Vec3[]): Vec3 | null => {
  const x = median(values.map((value) => value.x));
  const y = median(values.map((value) => value.y));
  const z = median(values.map((value) => value.z));
  return x === null || y === null || z === null ? null : { x, y, z };
};

export const featureMad = (
  features: readonly WrestlingPoseFeatures[],
): {
  hipHeight: number;
  torsoAngle: number;
  stanceWidth: number;
  bodyCenter: number;
} => {
  const centerX = median(features.map((feature) => feature.bodyCenterImage.x)) ?? 0;
  const centerY = median(features.map((feature) => feature.bodyCenterImage.y)) ?? 0;
  return {
    hipHeight: medianAbsoluteDeviation(features.map((feature) => feature.hipCenterImage.y)) ?? Infinity,
    torsoAngle: medianAbsoluteDeviation(features.map((feature) => feature.torsoAngleDeg)) ?? Infinity,
    stanceWidth: medianAbsoluteDeviation(features.map((feature) => feature.stanceWidthNormalized)) ?? Infinity,
    bodyCenter: median(features.map((feature) => Math.hypot(feature.bodyCenterImage.x - centerX, feature.bodyCenterImage.y - centerY))) ?? Infinity,
  };
};

export const stanceHeightM = (feature: WrestlingPoseFeatures): number =>
  distance3(feature.shoulderCenterWorld, feature.ankleCenterWorld);
