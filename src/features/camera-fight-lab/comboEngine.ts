import { checkHit, isInsideTarget } from "./hitDetector";
import { OnsetDetector } from "./onsetDetector";
import { roundMetric } from "./statistics";
import type {
  ComboOutcome,
  ComboStepResult,
  ComboTrialResult,
  Hand,
  TargetSnapshot,
  WristObservation,
} from "./types";

export const COMBO_PRESETS = {
  "L-R": ["left", "right"],
  "R-L": ["right", "left"],
  "L-R-L": ["left", "right", "left"],
  "R-L-R": ["right", "left", "right"],
} as const satisfies Record<string, readonly Hand[]>;

export type ComboPresetId = keyof typeof COMBO_PRESETS;
export const COMBO_PRESET_IDS = Object.keys(COMBO_PRESETS) as ComboPresetId[];

export function comboLabel(sequence: readonly Hand[]): string {
  return sequence.map((hand) => (hand === "left" ? "SOL" : "SAĞ")).join(" · ");
}

export function comboPresetIdForSequence(sequence: readonly Hand[] | null): ComboPresetId | null {
  if (!sequence) return null;
  const match = COMBO_PRESET_IDS.find((id) => {
    const preset = COMBO_PRESETS[id];
    return preset.length === sequence.length && preset.every((hand, index) => hand === sequence[index]);
  });
  return match ?? null;
}

export function pickComboPreset(
  previousPresetId: ComboPresetId | null,
  rng: () => number = Math.random,
): ComboPresetId {
  const candidates = COMBO_PRESET_IDS.filter((id) => id !== previousPresetId);
  const pool = candidates.length > 0 ? candidates : COMBO_PRESET_IDS;
  const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  return pool[index];
}

/**
 * Tek bir hedefe konfigüre edilebilir el sırasıyla (ör. Sol-Sağ) art arda atılan
 * yumrukları izleyen saf state machine. Her adım kabul edilen temastan sonra
 * onset detector'ları sıfırlar ve ilgili eli hedeften çıkana kadar tekrar
 * saymaz — bu, aynı sürekli temasın iki adımı birden tamamlamasını engeller.
 */
export class ComboSequenceTracker {
  private stepIndex = 0;
  private readonly steps: ComboStepResult[] = [];
  private readonly onsetDetectors: Record<Hand, OnsetDetector> = {
    left: new OnsetDetector(),
    right: new OnsetDetector(),
  };
  private readonly wasOutside: Record<Hand, boolean> = { left: true, right: true };
  private lastEventMs: number;
  private duplicateContactRejectedCount = 0;
  private resolved: ComboTrialResult | null = null;

  constructor(
    private readonly sequence: readonly Hand[],
    private readonly t0Ms: number,
  ) {
    this.lastEventMs = t0Ms;
  }

  get isFinished(): boolean {
    return this.resolved !== null;
  }

  get currentStepIndex(): number {
    return this.stepIndex;
  }

  get expectedHand(): Hand | null {
    return this.sequence[this.stepIndex] ?? null;
  }

  get stepHistory(): readonly ComboStepResult[] {
    return this.steps;
  }

  get duplicateContactCount(): number {
    return this.duplicateContactRejectedCount;
  }

  /**
   * Tek bir video frame'inin sol/sağ gözlemlerini işler. `target`, o anki
   * canvas boyutuna göre yeniden ölçeklenmiş halde her çağrıda taze verilir
   * (canvas/pencere resize'ına karşı diğer protokollerle aynı davranış).
   */
  update(
    observations: { left: WristObservation | null; right: WristObservation | null },
    target: TargetSnapshot,
  ): ComboTrialResult | null {
    if (this.resolved) return this.resolved;

    for (const hand of ["left", "right"] as const) {
      if (this.resolved) break;
      const observation = observations[hand];
      if (!observation || observation.timestampMs < this.t0Ms) continue;

      const onset = this.onsetDetectors[hand].update(observation, this.lastEventMs);
      const inside = isInsideTarget(observation.display, target);
      if (!inside) this.wasOutside[hand] = true;

      const hit = checkHit({
        targetActive: true,
        trialCompleted: false,
        observation,
        target,
        t1Ms: onset.t1Ms,
        wasOutsideTarget: this.wasOutside[hand],
      });

      if (!hit.accepted) {
        if (hit.reason === "HAND_ALREADY_IN_TARGET") {
          this.duplicateContactRejectedCount += 1;
        }
        continue;
      }

      // Kabul edilen temas: aynı sürekli temas bir sonraki adımı tamamlayamasın diye
      // el, hedeften yeniden çıkana kadar bu bayrak false kalır.
      this.wasOutside[hand] = false;

      const expected = this.sequence[this.stepIndex];
      const failedStepIndex = this.stepIndex;
      const contactMs = observation.timestampMs;
      const reactionMs =
        this.stepIndex === 0
          ? roundMetric(onset.t1Ms !== null ? onset.t1Ms - this.lastEventMs : null, 1)
          : null;
      const interPunchMs =
        this.stepIndex === 0 ? null : roundMetric(contactMs - this.lastEventMs, 1);

      this.steps.push({
        stepIndex: this.stepIndex,
        expectedHand: expected,
        actualHand: hand,
        correct: hand === expected,
        onsetMs: onset.t1Ms,
        contactMs,
        reactionMs,
        interPunchMs,
        peakVelocityMps: roundMetric(observation.velocityMps, 3),
      });

      if (hand !== expected) {
        this.finish("WRONG_HAND", failedStepIndex, contactMs);
        break;
      }

      this.lastEventMs = contactMs;
      this.stepIndex += 1;
      this.onsetDetectors.left.reset();
      this.onsetDetectors.right.reset();

      if (this.stepIndex >= this.sequence.length) {
        this.finish("COMPLETE", null, contactMs);
        break;
      }
    }

    return this.resolved;
  }

  /** TIMEOUT/INVALID gibi trial dışından tetiklenen sonuçlar için mevcut adım geçmişini donduran yol. */
  finishExternally(
    outcome: Extract<ComboOutcome, "TIMEOUT" | "INVALID">,
    endMs: number,
  ): ComboTrialResult {
    if (!this.resolved) this.finish(outcome, this.stepIndex, endMs);
    return this.resolved!;
  }

  private finish(outcome: ComboOutcome, errorStepIndex: number | null, endMs: number): void {
    this.resolved = {
      sequence: this.sequence,
      steps: [...this.steps],
      outcome,
      errorStepIndex,
      totalComboTimeMs: outcome === "COMPLETE" ? roundMetric(endMs - this.t0Ms, 1) : null,
      duplicateContactRejectedCount: this.duplicateContactRejectedCount,
    };
  }
}
