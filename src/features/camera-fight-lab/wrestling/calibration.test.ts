import { describe, expect, it } from "vitest";
import { evaluateWrestlingCalibration } from "./calibration";
import { wrestlingPose } from "./fixtures";

const camera = { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 };

describe("W0 wrestling calibration", () => {
  it("captures a stable full-body wrestling stance without replacing boxing calibration", () => {
    const samples = Array.from({ length: 50 }, (_, index) => wrestlingPose(index * 33));
    const result = evaluateWrestlingCalibration(samples, camera, samples.at(-1)!.timestampMs);
    expect(result.ready).toBe(true);
    expect(result.snapshot?.kind).toBe("wrestling");
    expect(result.snapshot?.stanceWidthNormalized).toBeCloseTo(0.24);
    expect(result.snapshot?.leftKneeBaselineImage.y).toBeCloseTo(0.68);
    expect(result.snapshot?.bodyCenterImage.y).toBeGreaterThan(0.3);
  });

  it("rejects missing lower-body tracking", () => {
    const samples = Array.from({ length: 50 }, (_, index) => {
      const sample = wrestlingPose(index * 33);
      return { ...sample, visibility: { ...sample.visibility, leftKnee: 0.1, rightKnee: 0.1 } };
    });
    const result = evaluateWrestlingCalibration(samples, camera, samples.at(-1)!.timestampMs);
    expect(result.ready).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("KNEES_MISSING");
  });

  it("rejects an unstable stance window", () => {
    const samples = Array.from({ length: 50 }, (_, index) => wrestlingPose(index * 33, {
      leftHip: { x: 0.45, y: index % 2 ? 0.42 : 0.54, z: 0 },
      rightHip: { x: 0.55, y: index % 2 ? 0.42 : 0.54, z: 0 },
    }));
    const result = evaluateWrestlingCalibration(samples, camera, samples.at(-1)!.timestampMs);
    expect(result.ready).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("STANCE_NOT_STABLE");
  });
});
