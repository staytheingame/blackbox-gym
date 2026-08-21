import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { OnsetDetector, type OnsetThresholds } from "./onsetDetector";
import { roundMetric } from "./statistics";
import type { DefenseAction, DefenseOutcome, DefenseTrialResult, HeadObservation, Vec2 } from "./types";

export const DEFENSE_ACTIONS: readonly DefenseAction[] = ["SLIP_LEFT", "SLIP_RIGHT", "DUCK"];

export function defenseActionLabel(action: DefenseAction): string {
  if (action === "SLIP_LEFT") return "SOLA SLIP";
  if (action === "SLIP_RIGHT") return "SAĞA SLIP";
  return "DUCK";
}

export function pickDefenseAction(
  previousAction: DefenseAction | null,
  rng: () => number = Math.random,
): DefenseAction {
  const candidates = DEFENSE_ACTIONS.filter((action) => action !== previousAction);
  const pool = candidates.length > 0 ? candidates : DEFENSE_ACTIONS;
  const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  return pool[index];
}

const HEAD_ONSET_THRESHOLDS: OnsetThresholds = {
  onsetVelocityMps: PERFORMANCE_CONFIG.phase3.head.onsetVelocityMps,
  onsetExitVelocityMps: PERFORMANCE_CONFIG.phase3.head.onsetExitVelocityMps,
  strongOnsetVelocityMps: PERFORMANCE_CONFIG.phase3.head.strongOnsetVelocityMps,
  minimumOnsetDisplacementM: PERFORMANCE_CONFIG.phase3.head.minimumOnsetDisplacementM,
  onsetConsecutiveFrames: PERFORMANCE_CONFIG.phase3.head.onsetConsecutiveFrames,
};

/**
 * Tek bir defense trial'ını izleyen saf state machine. Yön/displacement,
 * mirrored display koordinatında ve shoulder-width birimiyle ölçülür — bu,
 * gerçek bir aynaya bakarken "sola slip" dendiğinde sporcunun sezgisel
 * olarak beklediği ekran-sol hareketiyle birebir örtüşür (aynalama, el
 * kimliğinde olduğu gibi konumsal hareketin yönünü tersine çevirmez).
 */
export class DefenseReflexTracker {
  private readonly onset = new OnsetDetector(HEAD_ONSET_THRESHOLDS);
  private onsetMs: number | null = null;
  private completionMs: number | null = null;
  private detectedAction: DefenseAction | null = null;
  private peakLateral = 0;
  private peakVertical = 0;
  private recoveryConsecutiveFrames = 0;
  private resolved: DefenseTrialResult | null = null;

  constructor(
    private readonly action: DefenseAction,
    private readonly t0Ms: number,
    private readonly shoulderWidthNormalized: number,
  ) {}

  get isFinished(): boolean {
    return this.resolved !== null;
  }

  get currentOnsetMs(): number | null {
    return this.onsetMs;
  }

  update(
    observation: HeadObservation,
    neutralDisplay: Vec2,
    canvasWidth: number,
    canvasHeight: number,
  ): DefenseTrialResult | null {
    if (this.resolved) return this.resolved;
    if (observation.timestampMs < this.t0Ms) return null;

    const onset = this.onset.update(observation, this.t0Ms);
    if (onset.t1Ms !== null && this.onsetMs === null) this.onsetMs = onset.t1Ms;

    const lateral =
      (observation.display.x - neutralDisplay.x) / canvasWidth / this.shoulderWidthNormalized;
    const vertical =
      (observation.display.y - neutralDisplay.y) / canvasHeight / this.shoulderWidthNormalized;
    if (Math.abs(lateral) > Math.abs(this.peakLateral)) this.peakLateral = lateral;
    if (vertical > this.peakVertical) this.peakVertical = vertical;

    const cfg = PERFORMANCE_CONFIG.phase3.defense;

    if (this.completionMs === null) {
      const lateralCrossed = Math.abs(lateral) >= cfg.minLateralDisplacementShoulderWidths;
      const verticalCrossed = vertical >= cfg.minVerticalDisplacementShoulderWidths;
      if (lateralCrossed || verticalCrossed) {
        this.completionMs = observation.timestampMs;
        this.detectedAction =
          verticalCrossed && (!lateralCrossed || vertical >= Math.abs(lateral))
            ? "DUCK"
            : lateral < 0
              ? "SLIP_LEFT"
              : "SLIP_RIGHT";
        if (this.detectedAction !== this.action) {
          // Wrong-direction completion is not a stable return-to-neutral event;
          // keep T3/recovery null so downstream metrics cannot misread it.
          this.finish("WRONG_DIRECTION", null);
        }
      }
      return this.resolved;
    }

    // Tamamlama doğruydu; şimdi nötr pozisyona stabil dönüşü izle.
    const distanceFromNeutral = Math.hypot(lateral, vertical);
    if (distanceFromNeutral <= cfg.recoveryZoneRadiusShoulderWidths) {
      this.recoveryConsecutiveFrames += 1;
    } else {
      this.recoveryConsecutiveFrames = 0;
    }
    if (this.recoveryConsecutiveFrames >= cfg.recoveryStableFrames) {
      this.finish("CORRECT", observation.timestampMs);
    } else if (observation.timestampMs - this.completionMs >= cfg.recoveryTimeoutMs) {
      this.finish("FAILED_RECOVERY", null);
    }
    return this.resolved;
  }

  /** TIMEOUT/INVALID veya yanıtsızlık gibi trial dışından tetiklenen sonuçlar için. */
  finishExternally(nowMs: number): DefenseTrialResult {
    if (this.resolved) return this.resolved;
    if (this.completionMs !== null) {
      // Doğru yönde tamamlandı ama stabil dönüş hiç gerçekleşmedi.
      this.finish("FAILED_RECOVERY", null);
    } else if (this.onsetMs !== null) {
      this.finish("INSUFFICIENT_DISPLACEMENT", null);
    } else {
      this.finish("NO_RESPONSE", null);
    }
    void nowMs;
    return this.resolved!;
  }

  private finish(outcome: DefenseOutcome, recoveryMs: number | null): void {
    const reactionMs =
      this.onsetMs !== null ? roundMetric(this.onsetMs - this.t0Ms, 1) : null;
    const movementMs =
      this.onsetMs !== null && this.completionMs !== null
        ? roundMetric(this.completionMs - this.onsetMs, 1)
        : null;
    const recoveryTimeMs =
      this.completionMs !== null && recoveryMs !== null
        ? roundMetric(recoveryMs - this.completionMs, 1)
        : null;
    this.resolved = {
      action: this.action,
      detectedAction: this.detectedAction,
      onsetMs: this.onsetMs,
      completionMs: this.completionMs,
      recoveryMs,
      reactionMs,
      movementMs,
      recoveryTimeMs,
      outcome,
      peakLateralDisplacementShoulderWidths: roundMetric(this.peakLateral, 3),
      peakVerticalDisplacementShoulderWidths: roundMetric(this.peakVertical, 3),
    };
  }
}
