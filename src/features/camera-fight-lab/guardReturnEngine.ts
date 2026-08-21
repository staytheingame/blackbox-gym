import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { roundMetric } from "./statistics";
import { distance2 } from "./vectorMath";
import type { GuardReturnResult, Hand, Vec2, WristObservation } from "./types";

/**
 * Bir vuruş kaydedildikten sonra elin kalibre edilmiş guard bölgesine stabil
 * biçimde dönüşünü (T3) izleyen saf state machine. Tek kare guard bölgesine
 * girmek dönüş saymaz; art arda `stabilityFrames` kare gerekir. Kısa süreli
 * girip-çıkmalar overshoot olarak sayılır.
 */
export class GuardReturnTracker {
  private consecutiveInside = 0;
  private overshootCount = 0;
  private resolved: GuardReturnResult | null = null;

  constructor(
    readonly hand: Hand,
    private readonly hitMs: number,
    private readonly stabilityFrames: number = PERFORMANCE_CONFIG.phase2.guardReturnStableFrames,
    private readonly timeoutMs: number = PERFORMANCE_CONFIG.phase2.guardReturnTimeoutMs,
  ) {}

  get isResolved(): boolean {
    return this.resolved !== null;
  }

  get consecutiveInsideFrames(): number {
    return this.consecutiveInside;
  }

  get overshootEventCount(): number {
    return this.overshootCount;
  }

  /**
   * `guardPoint`/`zoneRadiusPx`, o anki canvas boyutuna göre her çağrıda taze
   * verilir (canvas/pencere resize'ına karşı diğer protokollerle aynı davranış).
   */
  update(
    observation: WristObservation,
    guardPoint: Vec2,
    zoneRadiusPx: number,
  ): GuardReturnResult | null {
    if (this.resolved) return this.resolved;
    if (observation.hand !== this.hand || observation.timestampMs < this.hitMs) return null;

    const inside = distance2(observation.display, guardPoint) <= zoneRadiusPx;
    if (inside) {
      this.consecutiveInside += 1;
    } else {
      if (this.consecutiveInside > 0 && this.consecutiveInside < this.stabilityFrames) {
        this.overshootCount += 1;
      }
      this.consecutiveInside = 0;
    }

    if (this.consecutiveInside >= this.stabilityFrames) {
      this.resolved = {
        hand: this.hand,
        hitMs: this.hitMs,
        t3Ms: observation.timestampMs,
        returnTimeMs: roundMetric(observation.timestampMs - this.hitMs, 1),
        outcome: "RETURNED",
        overshootCount: this.overshootCount,
      };
    } else if (observation.timestampMs - this.hitMs >= this.timeoutMs) {
      this.resolved = {
        hand: this.hand,
        hitMs: this.hitMs,
        t3Ms: null,
        returnTimeMs: null,
        outcome: "FAILED_RETURN",
        overshootCount: this.overshootCount,
      };
    }

    return this.resolved;
  }

  /** Pose tracking tamamen kesilirse dış güvenlik zaman aşımının çağıracağı yol. */
  forceResolve(): GuardReturnResult {
    if (!this.resolved) {
      this.resolved = {
        hand: this.hand,
        hitMs: this.hitMs,
        t3Ms: null,
        returnTimeMs: null,
        outcome: "FAILED_RETURN",
        overshootCount: this.overshootCount,
      };
    }
    return this.resolved;
  }
}
