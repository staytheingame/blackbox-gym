import type { PoseSample, Vec3 } from "../types";

const point = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });

export function wrestlingPose(timestampMs: number, overrides: Partial<PoseSample["image"]> = {}): PoseSample {
  const image = {
    nose: point(0.5, 0.08),
    leftShoulder: point(0.43, 0.25), rightShoulder: point(0.57, 0.25),
    leftElbow: point(0.4, 0.36), rightElbow: point(0.6, 0.36),
    leftWrist: point(0.44, 0.4), rightWrist: point(0.56, 0.4),
    leftHip: point(0.45, 0.48), rightHip: point(0.55, 0.48),
    leftKnee: point(0.42, 0.68), rightKnee: point(0.58, 0.68),
    leftAnkle: point(0.38, 0.9, -0.03), rightAnkle: point(0.62, 0.9, 0.03),
    leftHeel: point(0.38, 0.91), rightHeel: point(0.62, 0.91),
    leftFootIndex: point(0.36, 0.92), rightFootIndex: point(0.64, 0.92),
    ...overrides,
  };
  const toWorld = (value: Vec3): Vec3 => ({ x: (value.x - 0.5) * 2, y: (0.5 - value.y) * 2, z: value.z });
  const world = Object.fromEntries(Object.entries(image).map(([key, value]) => [key, toWorld(value as Vec3)])) as PoseSample["world"];
  return {
    timestampMs,
    poseCount: 1,
    image,
    world,
    visibility: {
      nose: 0.95,
      leftWrist: 0.95, rightWrist: 0.95,
      leftElbow: 0.95, rightElbow: 0.95,
      leftShoulder: 0.95, rightShoulder: 0.95,
      leftHip: 0.95, rightHip: 0.95,
      leftKnee: 0.95, rightKnee: 0.95,
      leftAnkle: 0.95, rightAnkle: 0.95,
      leftHeel: 0.95, rightHeel: 0.95,
      leftFootIndex: 0.95, rightFootIndex: 0.95,
    },
  };
}

export function wrestlingMotionPose(
  timestampMs: number,
  movement: { dx?: number; dy?: number; torsoLean?: number; stanceDelta?: number } = {},
): PoseSample {
  const base = wrestlingPose(timestampMs);
  const dx = movement.dx ?? 0;
  const dy = movement.dy ?? 0;
  const lean = movement.torsoLean ?? 0;
  const stanceDelta = movement.stanceDelta ?? 0;
  const image = Object.fromEntries(
    Object.entries(base.image).map(([key, point]) => {
      if (!point) return [key, point];
      const upper = ["nose", "leftShoulder", "rightShoulder"].includes(key);
      const ankleSide = key.startsWith("left") ? -stanceDelta : key.startsWith("right") ? stanceDelta : 0;
      return [key, {
        x: point.x + dx + (upper ? lean : 0) + (["leftAnkle", "rightAnkle", "leftHeel", "rightHeel", "leftFootIndex", "rightFootIndex"].includes(key) ? ankleSide : 0),
        y: point.y + dy,
        z: point.z,
      }];
    }),
  ) as PoseSample["image"];
  const toWorld = (value: Vec3): Vec3 => ({ x: (value.x - 0.5) * 2, y: (0.5 - value.y) * 2, z: value.z });
  return {
    ...base,
    timestampMs,
    image,
    world: Object.fromEntries(Object.entries(image).map(([key, value]) => [key, value ? toWorld(value) : value])) as PoseSample["world"],
  };
}
