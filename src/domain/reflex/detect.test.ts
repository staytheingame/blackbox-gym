import { describe, expect, it } from "vitest";
import type { PoseLandmark } from "@/domain/fight-analytics/metrics";
import {
  averageFeatures,
  detectReaction,
  extractFeatures,
  guardUpRatio,
  moveProgress,
  type PoseFeatures,
} from "./detect";
import { MOVE_BY_ID } from "./moves";

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

/**
 * Kameraya dönük, guard'ı yukarıda duran bir kişi.
 * Gövde boyu = omuz ortası (0.5, 0.35) ↔ kalça ortası (0.5, 0.60) = 0.25.
 */
function standing(overrides: Record<number, { x: number; y: number }> = {}): PoseLandmark[] {
  const base: Record<number, { x: number; y: number }> = {
    [NOSE]: { x: 0.5, y: 0.2 },
    [LEFT_SHOULDER]: { x: 0.6, y: 0.35 },
    [RIGHT_SHOULDER]: { x: 0.4, y: 0.35 },
    [LEFT_WRIST]: { x: 0.56, y: 0.3 },
    [RIGHT_WRIST]: { x: 0.44, y: 0.3 },
    [LEFT_HIP]: { x: 0.57, y: 0.6 },
    [RIGHT_HIP]: { x: 0.43, y: 0.6 },
    27: { x: 0.57, y: 0.95 },
    28: { x: 0.43, y: 0.95 },
  };
  const merged = { ...base, ...overrides };
  return Array.from({ length: 33 }, (_, index) => ({
    x: merged[index]?.x ?? 0.5,
    y: merged[index]?.y ?? 0.5,
    visibility: 0.9,
  }));
}

const featuresOf = (
  landmarks: PoseLandmark[],
  tMs: number,
): PoseFeatures => {
  const features = extractFeatures(landmarks, tMs);
  if (!features) throw new Error("özellik çıkarılamadı");
  return features;
};

const move = (id: string) => {
  const found = MOVE_BY_ID.get(id);
  if (!found) throw new Error(`bilinmeyen hamle: ${id}`);
  return found;
};

describe("extractFeatures", () => {
  it("ana eklemler görünmüyorsa null döner", () => {
    const landmarks = standing();
    landmarks[LEFT_SHOULDER].visibility = 0.05;
    expect(extractFeatures(landmarks, 0)).toBeNull();
    expect(extractFeatures(null, 0)).toBeNull();
  });

  it("gövde ölçeğini ve kişinin sol yönünü çıkarır", () => {
    const features = featuresOf(standing(), 0);
    expect(features.torso).toBeCloseTo(0.25, 3);
    expect(features.leftSign).toBe(1);
    expect(features.guardUp).toBe(true);
  });

  it("eller belin altındayken guard düşük sayılır", () => {
    const features = featuresOf(
      standing({ [LEFT_WRIST]: { x: 0.56, y: 0.7 }, [RIGHT_WRIST]: { x: 0.44, y: 0.7 } }),
      0,
    );
    expect(features.guardUp).toBe(false);
  });
});

describe("moveProgress", () => {
  const baseline = averageFeatures([featuresOf(standing(), 0)])!;

  it("doğru elin uzanması jab'i eşiğin üstüne taşır", () => {
    const punch = featuresOf(standing({ [LEFT_WRIST]: { x: 0.7, y: 0.28 } }), 100);
    expect(moveProgress(baseline, punch, move("sol-jab"))).toBeGreaterThanOrEqual(1);
  });

  it("yanlış el uzanınca istenen hamle eşiği aşmaz", () => {
    const punch = featuresOf(standing({ [RIGHT_WRIST]: { x: 0.3, y: 0.28 } }), 100);
    expect(moveProgress(baseline, punch, move("sol-jab"))).toBeLessThan(1);
    expect(moveProgress(baseline, punch, move("sag-direkt"))).toBeGreaterThanOrEqual(1);
  });

  it("slip yönü kişinin sol/sağını ayırt eder", () => {
    const slipLeft = featuresOf(standing({ [NOSE]: { x: 0.56, y: 0.2 } }), 100);
    expect(moveProgress(baseline, slipLeft, move("sol-slip"))).toBeGreaterThanOrEqual(1);
    expect(moveProgress(baseline, slipLeft, move("sag-slip"))).toBeLessThan(0);
  });

  it("eğilme gövdenin aşağı inmesiyle ölçülür", () => {
    const duck = featuresOf(
      standing({
        [NOSE]: { x: 0.5, y: 0.28 },
        [LEFT_SHOULDER]: { x: 0.6, y: 0.43 },
        [RIGHT_SHOULDER]: { x: 0.4, y: 0.43 },
      }),
      100,
    );
    expect(moveProgress(baseline, duck, move("egil"))).toBeGreaterThanOrEqual(1);
  });

  it("geri çekilme iskeletin küçülmesiyle ölçülür", () => {
    const retreat = featuresOf(
      standing({
        [LEFT_SHOULDER]: { x: 0.575, y: 0.35 },
        [RIGHT_SHOULDER]: { x: 0.425, y: 0.35 },
      }),
      100,
    );
    expect(moveProgress(baseline, retreat, move("geri-cekil"))).toBeGreaterThanOrEqual(1);
  });
});

describe("detectReaction", () => {
  const cue = 1000;
  const baseline = averageFeatures([
    featuresOf(standing(), cue - 200),
    featuresOf(standing(), cue - 100),
  ])!;

  it("hareket başlangıcını hamlenin tamamlanmasından önce yakalar", () => {
    const frames = [
      featuresOf(standing(), cue + 30),
      featuresOf(standing(), cue + 60),
      // küçük ilk kıpırdanma → onset
      featuresOf(standing({ [LEFT_WRIST]: { x: 0.59, y: 0.29 } }), cue + 240),
      // tam uzanma → tamamlanma
      featuresOf(standing({ [LEFT_WRIST]: { x: 0.72, y: 0.28 } }), cue + 330),
    ];

    const result = detectReaction(baseline, frames, move("sol-jab"), cue);
    expect(result.matched).toBe(true);
    expect(result.onsetMs).toBe(240);
    expect(result.completionMs).toBe(330);
    expect(result.onsetMs!).toBeLessThan(result.completionMs!);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("yanlış taraf hamlesinde eşleşme vermez ve görülen hamleyi bildirir", () => {
    const frames = [
      featuresOf(standing(), cue + 30),
      featuresOf(standing({ [RIGHT_WRIST]: { x: 0.28, y: 0.28 } }), cue + 300),
    ];

    const result = detectReaction(baseline, frames, move("sol-jab"), cue);
    expect(result.matched).toBe(false);
    expect(result.onsetMs).toBe(300);
    expect(result.detectedMoveId).toMatch(/^sag/);
  });

  it("kişi hiç kıpırdamazsa onset de eşleşme de yoktur", () => {
    const frames = [
      featuresOf(standing(), cue + 100),
      featuresOf(standing(), cue + 400),
      featuresOf(standing(), cue + 900),
    ];
    const result = detectReaction(baseline, frames, move("sol-jab"), cue);
    expect(result.onsetMs).toBeNull();
    expect(result.matched).toBe(false);
    expect(result.detectedMoveId).toBeNull();
  });

  it("baseline yoksa boş sonuç döner", () => {
    const result = detectReaction(null, [featuresOf(standing(), cue)], move("sol-jab"), cue);
    expect(result.matched).toBe(false);
    expect(result.sampleCount).toBe(1);
  });
});

describe("guardUpRatio", () => {
  it("guard'ın yukarıda kaldığı kare oranını verir", () => {
    const low = standing({
      [LEFT_WRIST]: { x: 0.56, y: 0.75 },
      [RIGHT_WRIST]: { x: 0.44, y: 0.75 },
    });
    const frames = [
      featuresOf(standing(), 0),
      featuresOf(standing(), 33),
      featuresOf(low, 66),
      featuresOf(low, 99),
    ];
    expect(guardUpRatio(frames)).toBe(0.5);
    expect(guardUpRatio([])).toBeNull();
  });
});
