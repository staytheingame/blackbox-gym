import { describe, expect, it } from "vitest";
import { COMBO_PRESETS, ComboSequenceTracker } from "./comboEngine";
import type { Hand, TargetSnapshot, WristObservation } from "./types";

const target: TargetSnapshot = {
  displayX: 100,
  displayY: 100,
  normalizedX: 0.5,
  normalizedY: 0.5,
  radiusPx: 20,
  radiusNormalized: 0.05,
  canvasWidth: 200,
  canvasHeight: 200,
  zoneIndex: 0,
};

/** Hedefe doğru yönde, kabul edilebilir hızda ve hedefin içinde tek bir kare üretir. */
const punchFrame = (
  hand: Hand,
  timestampMs: number,
  options: Partial<WristObservation> = {},
): WristObservation => ({
  hand,
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.5, y: 0.5, z: 0 },
  display: { x: 100, y: 100 },
  previousDisplay: { x: 50, y: 100 },
  velocityMps: 1.2,
  displacementFromGuardM: 0.04,
  displacementDeltaM: 0.01,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

/** Hedefin dışında, temas saymayan bir kare (geri çekilme simülasyonu). */
const retractFrame = (
  hand: Hand,
  timestampMs: number,
  options: Partial<WristObservation> = {},
): WristObservation => ({
  hand,
  timestampMs,
  world: { x: timestampMs / 1_000, y: 0, z: 0 },
  image: { x: 0.2, y: 0.5, z: 0 },
  display: { x: 10, y: 100 },
  previousDisplay: { x: 100, y: 100 },
  velocityMps: 0.1,
  displacementFromGuardM: 0.01,
  displacementDeltaM: -0.01,
  confidence: 0.95,
  frameGap: false,
  landmarkJump: false,
  ...options,
});

const emptyFrame = { left: null, right: null };

describe("combo sequence tracker mocked landmark sequences", () => {
  it("completes a valid L-R combo with per-step timing", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R"], 1_000);
    expect(tracker.update({ ...emptyFrame, left: punchFrame("left", 1_200) }, target)).toBeNull();
    const result = tracker.update(
      { ...emptyFrame, right: punchFrame("right", 1_450) },
      target,
    );
    expect(result).toMatchObject({ outcome: "COMPLETE", errorStepIndex: null });
    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[0]).toMatchObject({ actualHand: "left", correct: true, reactionMs: 200 });
    expect(result?.steps[1]).toMatchObject({ actualHand: "right", correct: true, interPunchMs: 250 });
    expect(result?.totalComboTimeMs).toBe(450);
  });

  it("completes a valid R-L combo", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["R-L"], 1_000);
    tracker.update({ ...emptyFrame, right: punchFrame("right", 1_180) }, target);
    const result = tracker.update({ ...emptyFrame, left: punchFrame("left", 1_400) }, target);
    expect(result?.outcome).toBe("COMPLETE");
    expect(result?.steps.map((step) => step.actualHand)).toEqual(["right", "left"]);
  });

  it("completes a valid L-R-L combo, allowing the repeated hand", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R-L"], 1_000);
    tracker.update({ ...emptyFrame, left: punchFrame("left", 1_200) }, target);
    tracker.update({ ...emptyFrame, right: punchFrame("right", 1_450) }, target);
    // Sol el üçüncü adımdan önce hedeften geri çekiliyor ki yeni bir temas sayılsın.
    tracker.update({ ...emptyFrame, left: retractFrame("left", 1_550) }, target);
    const result = tracker.update({ ...emptyFrame, left: punchFrame("left", 1_700) }, target);
    expect(result?.outcome).toBe("COMPLETE");
    expect(result?.steps).toHaveLength(3);
    expect(result?.steps[2]).toMatchObject({ stepIndex: 2, expectedHand: "left", correct: true });
  });

  it("flags wrong order when the first punch uses the wrong hand", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R"], 1_000);
    const result = tracker.update({ ...emptyFrame, right: punchFrame("right", 1_200) }, target);
    expect(result).toMatchObject({ outcome: "WRONG_HAND", errorStepIndex: 0 });
    expect(result?.steps[0]).toMatchObject({ expectedHand: "left", actualHand: "right", correct: false });
  });

  it("flags wrong order when the same hand punches twice in a row", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R"], 1_000);
    tracker.update({ ...emptyFrame, left: punchFrame("left", 1_200) }, target);
    // El geri çekiliyor (hedefin dışına çıkıyor) ki ikinci temas yeni bir temas sayılsın.
    tracker.update({ ...emptyFrame, left: retractFrame("left", 1_300) }, target);
    const result = tracker.update({ ...emptyFrame, left: punchFrame("left", 1_450) }, target);
    expect(result).toMatchObject({ outcome: "WRONG_HAND", errorStepIndex: 1 });
    expect(result?.steps[1]).toMatchObject({ expectedHand: "right", actualHand: "left", correct: false });
  });

  it("does not let a single continuous contact complete two steps", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R"], 1_000);
    expect(tracker.update({ ...emptyFrame, left: punchFrame("left", 1_200) }, target)).toBeNull();
    expect(tracker.currentStepIndex).toBe(1);
    // El hedefte kalmaya devam ediyor; ikinci adım (sağ) beklenirken sol elin
    // aynı sürekli teması bu adımı tamamlayamamalı.
    expect(tracker.update({ ...emptyFrame, left: punchFrame("left", 1_233) }, target)).toBeNull();
    expect(tracker.update({ ...emptyFrame, left: punchFrame("left", 1_266) }, target)).toBeNull();
    expect(tracker.currentStepIndex).toBe(1);
    expect(tracker.duplicateContactCount).toBeGreaterThan(0);

    const result = tracker.update({ ...emptyFrame, right: punchFrame("right", 1_450) }, target);
    expect(result).toMatchObject({ outcome: "COMPLETE" });
    expect(result?.duplicateContactRejectedCount).toBeGreaterThan(0);
  });

  it("freezes partial step history on an externally triggered timeout", () => {
    const tracker = new ComboSequenceTracker(COMBO_PRESETS["L-R-L"], 1_000);
    tracker.update({ ...emptyFrame, left: punchFrame("left", 1_200) }, target);
    const result = tracker.finishExternally("TIMEOUT", 1_900);
    expect(result.outcome).toBe("TIMEOUT");
    expect(result.steps).toHaveLength(1);
    expect(result.totalComboTimeMs).toBeNull();
  });
});
