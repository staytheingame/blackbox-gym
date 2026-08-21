import { EMPTY_VISIBILITY, type PoseSample, type Vec3 } from "./types";

type LandmarkLike = {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
};

type PoseResultLike = {
  landmarks?: LandmarkLike[][];
  worldLandmarks?: LandmarkLike[][];
};

const INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

const pointAt = (landmarks: LandmarkLike[] | undefined, index: number): Vec3 | undefined => {
  const point = landmarks?.[index];
  if (
    !point ||
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
    typeof point.z !== "number"
  ) {
    return undefined;
  }
  return { x: point.x, y: point.y, z: point.z };
};

const visibilityAt = (landmarks: LandmarkLike[] | undefined, index: number): number =>
  landmarks?.[index]?.visibility ?? 0;

export function mapPoseResult(result: PoseResultLike, timestampMs: number): PoseSample {
  const image = result.landmarks?.[0];
  const world = result.worldLandmarks?.[0];
  return {
    timestampMs,
    poseCount: result.landmarks?.length ?? 0,
    image: {
      nose: pointAt(image, INDEX.nose),
      leftShoulder: pointAt(image, INDEX.leftShoulder),
      rightShoulder: pointAt(image, INDEX.rightShoulder),
      leftElbow: pointAt(image, INDEX.leftElbow),
      rightElbow: pointAt(image, INDEX.rightElbow),
      leftWrist: pointAt(image, INDEX.leftWrist),
      rightWrist: pointAt(image, INDEX.rightWrist),
      leftHip: pointAt(image, INDEX.leftHip),
      rightHip: pointAt(image, INDEX.rightHip),
      leftKnee: pointAt(image, INDEX.leftKnee),
      rightKnee: pointAt(image, INDEX.rightKnee),
      leftAnkle: pointAt(image, INDEX.leftAnkle),
      rightAnkle: pointAt(image, INDEX.rightAnkle),
      leftHeel: pointAt(image, INDEX.leftHeel),
      rightHeel: pointAt(image, INDEX.rightHeel),
      leftFootIndex: pointAt(image, INDEX.leftFootIndex),
      rightFootIndex: pointAt(image, INDEX.rightFootIndex),
    },
    world: {
      nose: pointAt(world, INDEX.nose),
      leftShoulder: pointAt(world, INDEX.leftShoulder),
      rightShoulder: pointAt(world, INDEX.rightShoulder),
      leftElbow: pointAt(world, INDEX.leftElbow),
      rightElbow: pointAt(world, INDEX.rightElbow),
      leftWrist: pointAt(world, INDEX.leftWrist),
      rightWrist: pointAt(world, INDEX.rightWrist),
      leftHip: pointAt(world, INDEX.leftHip),
      rightHip: pointAt(world, INDEX.rightHip),
      leftKnee: pointAt(world, INDEX.leftKnee),
      rightKnee: pointAt(world, INDEX.rightKnee),
      leftAnkle: pointAt(world, INDEX.leftAnkle),
      rightAnkle: pointAt(world, INDEX.rightAnkle),
      leftHeel: pointAt(world, INDEX.leftHeel),
      rightHeel: pointAt(world, INDEX.rightHeel),
      leftFootIndex: pointAt(world, INDEX.leftFootIndex),
      rightFootIndex: pointAt(world, INDEX.rightFootIndex),
    },
    visibility: image
      ? {
          nose: visibilityAt(image, INDEX.nose),
          leftShoulder: visibilityAt(image, INDEX.leftShoulder),
          rightShoulder: visibilityAt(image, INDEX.rightShoulder),
          leftElbow: visibilityAt(image, INDEX.leftElbow),
          rightElbow: visibilityAt(image, INDEX.rightElbow),
          leftWrist: visibilityAt(image, INDEX.leftWrist),
          rightWrist: visibilityAt(image, INDEX.rightWrist),
          leftHip: visibilityAt(image, INDEX.leftHip),
          rightHip: visibilityAt(image, INDEX.rightHip),
          leftKnee: visibilityAt(image, INDEX.leftKnee),
          rightKnee: visibilityAt(image, INDEX.rightKnee),
          leftAnkle: visibilityAt(image, INDEX.leftAnkle),
          rightAnkle: visibilityAt(image, INDEX.rightAnkle),
          leftHeel: visibilityAt(image, INDEX.leftHeel),
          rightHeel: visibilityAt(image, INDEX.rightHeel),
          leftFootIndex: visibilityAt(image, INDEX.leftFootIndex),
          rightFootIndex: visibilityAt(image, INDEX.rightFootIndex),
        }
      : { ...EMPTY_VISIBILITY },
  };
}
