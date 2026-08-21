import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import type { WrestlingMotionSnapshot } from "./protocolTypes";

export type RecoveryUpdate = {
  recovered: boolean;
  timedOut: boolean;
  t3Ms: number | null;
  stableFrames: number;
};

/** W14: shot, sprawl, movement, hand-fighting ve chain tarafından paylaşılan T3 state machine. */
export class StableStanceRecoveryTracker {
  private consecutiveStableFrames = 0;
  private t3Ms: number | null = null;

  constructor(private readonly t2Ms: number) {}

  update(motion: WrestlingMotionSnapshot, timestampMs: number): RecoveryUpdate {
    const config = PERFORMANCE_CONFIG.wrestling.recovery;
    if (this.t3Ms === null) {
      const stable = motion.bodyDisplacement.magnitude <= config.bodyCenterToleranceNormalized &&
        Math.abs(motion.hipHeightDeltaNormalized) <= config.hipHeightToleranceNormalized &&
        Math.abs(motion.torsoAngleDeltaDeg) <= config.torsoAngleToleranceDeg &&
        Math.abs(motion.stanceWidthDeltaNormalized) <= config.stanceWidthToleranceNormalized &&
        motion.compositeVelocity <= config.maxCompositeVelocity;
      this.consecutiveStableFrames = stable ? this.consecutiveStableFrames + 1 : 0;
      if (this.consecutiveStableFrames >= config.stableFrames) this.t3Ms = timestampMs;
    }
    return {
      recovered: this.t3Ms !== null,
      timedOut: this.t3Ms === null && timestampMs - this.t2Ms >= config.timeoutMs,
      t3Ms: this.t3Ms,
      stableFrames: this.consecutiveStableFrames,
    };
  }
}
