import { describe, expect, it } from "vitest";
import { mapPoseResult } from "./poseMapper";

const landmarks = Array.from({ length: 33 }, (_, index) => ({
  x: index / 100,
  y: index / 200,
  z: index / 300,
  visibility: 0.9,
}));

describe("pose mapper", () => {
  it("keeps image and world wrist coordinates separate and preserves handedness", () => {
    const world = landmarks.map((point) => ({ ...point, x: point.x + 1 }));
    const sample = mapPoseResult({ landmarks: [landmarks], worldLandmarks: [world] }, 123.4);
    expect(sample.timestampMs).toBe(123.4);
    expect(sample.image.leftWrist?.x).toBe(0.15);
    expect(sample.image.rightWrist?.x).toBe(0.16);
    expect(sample.world.leftWrist?.x).toBe(1.15);
    expect(sample.visibility.leftWrist).toBe(0.9);
    expect(sample.image.leftKnee?.x).toBe(0.25);
    expect(sample.image.rightAnkle?.x).toBe(0.28);
    expect(sample.visibility.nose).toBe(0.9);
  });

  it("returns an explicit empty sample on tracking dropout", () => {
    const sample = mapPoseResult({}, 50);
    expect(sample.poseCount).toBe(0);
    expect(sample.image.leftWrist).toBeUndefined();
    expect(sample.visibility.leftWrist).toBe(0);
  });
});
