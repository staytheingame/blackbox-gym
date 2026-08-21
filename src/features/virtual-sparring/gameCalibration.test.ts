import { describe, expect, it } from "vitest";
import { EMPTY_VISIBILITY, type CameraSnapshot, type PoseSample } from "../camera-fight-lab/types";
import { evaluateGameCalibration, GAME_CALIBRATION } from "./gameCalibration";

const camera: CameraSnapshot = {
  deviceId: "cam",
  deviceLabel: "Kamera",
  width: 1_280,
  height: 720,
  frameRate: 30,
  facingMode: "user",
};

type SampleOptions = {
  timestampMs: number;
  shoulderWidth?: number;
  shoulderVisibility?: number;
  noseVisibility?: number;
  wrists?: boolean;
  poseCount?: number;
};

function sample({
  timestampMs,
  shoulderWidth = 0.25,
  shoulderVisibility = 0.9,
  noseVisibility = 0.9,
  wrists = true,
  poseCount = 1,
}: SampleOptions): PoseSample {
  const half = shoulderWidth / 2;
  const point = (x: number, y: number) => ({ x, y, z: 0 });
  return {
    timestampMs,
    poseCount,
    image: {
      nose: point(0.5, 0.3),
      leftShoulder: point(0.5 + half, 0.42),
      rightShoulder: point(0.5 - half, 0.42),
      ...(wrists ? { leftWrist: point(0.56, 0.36), rightWrist: point(0.44, 0.36) } : {}),
    },
    world: {
      nose: point(0, 0.25),
      leftShoulder: point(0.2, 0),
      rightShoulder: point(-0.2, 0),
      ...(wrists ? { leftWrist: point(0.1, 0.2), rightWrist: point(-0.1, 0.2) } : {}),
    },
    visibility: {
      ...EMPTY_VISIBILITY,
      nose: noseVisibility,
      leftShoulder: shoulderVisibility,
      rightShoulder: shoulderVisibility,
      leftWrist: wrists ? 0.9 : 0,
      rightWrist: wrists ? 0.9 : 0,
    },
  } as PoseSample;
}

function series(count: number, options: Partial<SampleOptions> = {}): PoseSample[] {
  // 10 fps — lab kalibrasyonunun "1,2 sn içinde 18 örnek" koşulunu asla
  // sağlayamayan, sahada sık görülen bir hız.
  return Array.from({ length: count }, (_, index) =>
    sample({ timestampMs: index * 100, ...options }),
  );
}

function evaluate(samples: PoseSample[], elapsedMs = 1_000) {
  return evaluateGameCalibration({
    samples,
    camera,
    nowMs: samples.at(-1)?.timestampMs ?? 0,
    elapsedMs,
  });
}

describe("evaluateGameCalibration", () => {
  it("kimse yokken tüm kontroller kırmızı ve zorla başlatma kapalı", () => {
    const state = evaluate([sample({ timestampMs: 0, poseCount: 0 })]);
    expect(state.ready).toBe(false);
    expect(state.canForce).toBe(false);
    expect(state.checks.every((item) => !item.ok)).toBe(true);
  });

  it("düşük fps'te bile hazır olur — oyunun kapısı sample sayısına takılmaz", () => {
    const state = evaluate(series(8));
    expect(state.ready).toBe(true);
    expect(state.snapshot).not.toBeNull();
    expect(state.progressPct).toBe(100);
  });

  it("guard kaldırılmamış olsa da hazır sayar", () => {
    // Lab kalibrasyonu RAISE_GUARD ister; oyun istemez.
    const relaxed = series(8).map((item) => ({
      ...item,
      image: { ...item.image, leftWrist: { x: 0.6, y: 0.9, z: 0 }, rightWrist: { x: 0.4, y: 0.9, z: 0 } },
    }));
    expect(evaluate(relaxed).ready).toBe(true);
  });

  it("bilekler hiç görünmese bile guard noktalarını omuzdan türetir", () => {
    const state = evaluate(series(8, { wrists: false }));
    expect(state.ready).toBe(true);
    expect(state.snapshot?.leftGuardImage).toBeDefined();
    expect(state.snapshot?.rightGuardImage).toBeDefined();
    // Türetilen guard omuzların İÇİNDE kalmalı.
    const snapshot = state.snapshot!;
    expect(snapshot.leftGuardImage.x).toBeLessThan(snapshot.leftShoulderImage.x);
    expect(snapshot.rightGuardImage.x).toBeGreaterThan(snapshot.rightShoulderImage.x);
  });

  it("omuzlar görünmüyorsa hazır olmaz ve nedeni gösterir", () => {
    const state = evaluate(series(8, { shoulderVisibility: 0.1 }));
    expect(state.ready).toBe(false);
    expect(state.checks.find((item) => item.id === "shoulders")?.ok).toBe(false);
  });

  it("çok yakın ya da çok uzak durmayı mesafe kontrolüyle bildirir", () => {
    const tooClose = evaluate(series(8, { shoulderWidth: 0.9 }));
    expect(tooClose.checks.find((item) => item.id === "distance")?.ok).toBe(false);
    expect(tooClose.checks.find((item) => item.id === "distance")?.hint).toContain("uzaklaş");

    const tooFar = evaluate(series(8, { shoulderWidth: 0.02 }));
    expect(tooFar.checks.find((item) => item.id === "distance")?.hint).toContain("yaklaş");
  });

  it("baş görünmüyorsa hazır olmaz ama snapshot yine kurulabilir", () => {
    const state = evaluate(series(8, { noseVisibility: 0.05 }));
    expect(state.ready).toBe(false);
    expect(state.snapshot).not.toBeNull();
  });

  it("uzun süre takılınca elle geçmeye izin verir", () => {
    const stuck = series(8, { noseVisibility: 0.05 });
    expect(evaluate(stuck, 1_000).canForce).toBe(false);
    expect(evaluate(stuck, GAME_CALIBRATION.forceAfterMs).canForce).toBe(true);
  });

  it("kadrajda kimse yoksa süre dolsa da elle geçilemez", () => {
    const state = evaluate([sample({ timestampMs: 0, poseCount: 0 })], 30_000);
    expect(state.canForce).toBe(false);
  });
});
