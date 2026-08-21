import { describe, expect, it } from "vitest";
import { analyzeFightFrames, type PoseFrame, type PoseLandmark } from "./metrics";

function baseLandmarks(overrides: Record<number, Partial<PoseLandmark>> = {}): PoseLandmark[] {
  const points: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  points[0] = { x: 0.5, y: 0.3 }; // nose
  points[11] = { x: 0.45, y: 0.4 }; // left shoulder
  points[12] = { x: 0.55, y: 0.4 }; // right shoulder
  points[15] = { x: 0.4, y: 0.4 }; // left wrist (guarded, default)
  points[16] = { x: 0.6, y: 0.4 }; // right wrist (guarded, default)
  points[23] = { x: 0.48, y: 0.6 }; // left hip
  points[24] = { x: 0.52, y: 0.6 }; // right hip
  points[27] = { x: 0.46, y: 0.9 }; // left ankle
  points[28] = { x: 0.54, y: 0.9 }; // right ankle

  for (const [index, patch] of Object.entries(overrides)) {
    const i = Number(index);
    points[i] = { ...points[i], ...patch };
  }
  return points;
}

describe("analyzeFightFrames", () => {
  it("boş kare listesinde kişi bulunamadı raporu döner", () => {
    const report = analyzeFightFrames([]);
    expect(report.personDetected).toBe(false);
    expect(report.overallScore).toBe(0);
  });

  it("landmark'sız (null) kareler baskınsa kişi bulunamadı sayılır", () => {
    const frames: PoseFrame[] = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: i * 100,
      landmarks: null,
    }));
    const report = analyzeFightFrames(frames);
    expect(report.personDetected).toBe(false);
  });

  it("guard yukarıdayken yüksek guard skoru verir", () => {
    const frames: PoseFrame[] = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: i * 100,
      landmarks: baseLandmarks(),
    }));
    const report = analyzeFightFrames(frames);
    expect(report.personDetected).toBe(true);
    expect(report.guardScore).toBe(100);
  });

  it("bilekler bel altına düştüğünde guard skoru düşer", () => {
    const frames: PoseFrame[] = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: i * 100,
      landmarks: baseLandmarks({ 15: { y: 0.7 }, 16: { y: 0.7 } }),
    }));
    const report = analyzeFightFrames(frames);
    expect(report.guardScore).toBe(0);
    expect(report.guardDropFrameRatio).toBe(1);
  });

  it("statik ayaklarda düşük, hareketli ayaklarda yüksek footwork skoru verir", () => {
    const staticFrames: PoseFrame[] = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: i * 100,
      landmarks: baseLandmarks(),
    }));
    const staticReport = analyzeFightFrames(staticFrames);
    expect(staticReport.footworkScore).toBe(0);

    const activeFrames: PoseFrame[] = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: i * 100,
      landmarks: baseLandmarks({
        27: { x: 0.46 + (i % 2 === 0 ? 0.08 : -0.08) },
        28: { x: 0.54 + (i % 2 === 0 ? 0.08 : -0.08) },
      }),
    }));
    const activeReport = analyzeFightFrames(activeFrames);
    expect(activeReport.footworkScore).toBeGreaterThan(staticReport.footworkScore);
  });

  it("burun sağa-sola sallandığında slip sayar", () => {
    const frames: PoseFrame[] = Array.from({ length: 8 }, (_, i) => ({
      timestampMs: i * 200,
      landmarks: baseLandmarks({ 0: { x: 0.5 + (i % 2 === 0 ? 0.05 : -0.05), y: 0.3 } }),
    }));
    const report = analyzeFightFrames(frames);
    expect(report.headSlipCount).toBeGreaterThan(0);
  });

  it("duruş genişliği omuz genişliğine oranlanır", () => {
    const frames: PoseFrame[] = [{ timestampMs: 0, landmarks: baseLandmarks() }];
    const report = analyzeFightFrames(frames);
    // ankle width 0.08 / shoulder width 0.10 = 0.8
    expect(report.stanceRatio).toBeCloseTo(0.8, 1);
  });
});
