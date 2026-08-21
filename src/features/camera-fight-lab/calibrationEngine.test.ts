import { describe, expect, it } from "vitest";
import { evaluateCalibration } from "./calibrationEngine";
import type { CameraSnapshot, PoseSample, Vec3 } from "./types";

const camera: CameraSnapshot = {
  deviceLabel: "Test Camera",
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: "user",
};

const point = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });

const sample = (timestampMs: number, shoulderWidth = 0.2): PoseSample => ({
  timestampMs,
  poseCount: 1,
  image: {
    nose: point(0.5, 0.28),
    leftShoulder: point(0.5 - shoulderWidth / 2, 0.35),
    rightShoulder: point(0.5 + shoulderWidth / 2, 0.35),
    leftElbow: point(0.41, 0.45),
    rightElbow: point(0.59, 0.45),
    leftWrist: point(0.43, 0.42),
    rightWrist: point(0.57, 0.42),
    leftHip: point(0.44, 0.65),
    rightHip: point(0.56, 0.65),
  },
  world: {
    nose: point(0, 0.35),
    leftShoulder: point(-0.2, 0.2),
    rightShoulder: point(0.2, 0.2),
    leftElbow: point(-0.18, 0.1),
    rightElbow: point(0.18, 0.1),
    leftWrist: point(-0.14, 0.18),
    rightWrist: point(0.14, 0.18),
    leftHip: point(-0.12, -0.2),
    rightHip: point(0.12, -0.2),
  },
  visibility: {
    nose: 0.95,
    leftWrist: 0.95,
    rightWrist: 0.95,
    leftElbow: 0.95,
    rightElbow: 0.95,
    leftShoulder: 0.95,
    rightShoulder: 0.95,
    leftHip: 0.95,
    rightHip: 0.95,
    leftKnee: 0.95,
    rightKnee: 0.95,
    leftAnkle: 0.95,
    rightAnkle: 0.95,
    leftHeel: 0.95,
    rightHeel: 0.95,
    leftFootIndex: 0.95,
    rightFootIndex: 0.95,
  },
});

describe("calibration engine", () => {
  it("accepts a stable, visible guard window and stores the baseline", () => {
    const samples = Array.from({ length: 40 }, (_, index) => sample(index * 33));
    const result = evaluateCalibration(samples, camera, samples.at(-1)?.timestampMs);
    expect(result.ready).toBe(true);
    expect(result.snapshot?.shoulderWidthM).toBeCloseTo(0.4);
    expect(result.snapshot?.leftGuardWorld).toEqual(point(-0.14, 0.18));
    expect(result.snapshot?.estimatedProcessingFps).toBeGreaterThan(29);
  });

  it("fails with no person", () => {
    expect(evaluateCalibration([], camera).issues[0].code).toBe("NO_PERSON");
  });

  it("requests more distance/framing when shoulders are too narrow", () => {
    const samples = Array.from({ length: 40 }, (_, index) => sample(index * 33, 0.08));
    const result = evaluateCalibration(samples, camera, samples.at(-1)?.timestampMs);
    expect(result.ready).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("MOVE_BACK");
  });

  it("rejects missing wrists and low-confidence tracking", () => {
    const samples = Array.from({ length: 40 }, (_, index) => {
      const value = sample(index * 33);
      return { ...value, visibility: { ...value.visibility, leftWrist: 0.1 } };
    });
    const result = evaluateCalibration(samples, camera, samples.at(-1)?.timestampMs);
    expect(result.ready).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("WRISTS_MISSING");
  });
});
