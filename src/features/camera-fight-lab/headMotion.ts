import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { imageToDisplayCanvas, type CanvasSize } from "./coordinates";
import { EmaVec3Filter } from "./smoothing";
import { distance3 } from "./vectorMath";
import { velocityMps } from "./velocity";
import type { HeadHistoryPoint, HeadObservation, PoseSample, Vec3 } from "./types";

/**
 * Bilek takibine paralel ama burun landmark'ı üzerinde çalışan baş hareketi
 * izleyicisi. Kasıtlı olarak `WristMotionTracker`'dan bağımsız tutulur ki
 * Phase 0-2'nin test edilmiş yumruk hattı bu değişiklikten etkilenmesin.
 */
export class HeadMotionTracker {
  private readonly worldFilter = new EmaVec3Filter(PERFORMANCE_CONFIG.phase3.head.emaAlpha);
  private readonly imageFilter = new EmaVec3Filter(PERFORMANCE_CONFIG.phase3.head.emaAlpha);
  private previous: {
    timestampMs: number;
    world: Vec3;
    display: { x: number; y: number };
    displacementFromNeutralM: number;
  } | null = null;
  private history: HeadHistoryPoint[] = [];

  update(
    sample: PoseSample,
    neutralWorld: Vec3 | null,
    canvas: CanvasSize,
  ): HeadObservation | null {
    const rawWorld = sample.world.nose;
    const rawImage = sample.image.nose;
    const confidence = sample.visibility.nose;

    if (!rawWorld || !rawImage || confidence < PERFORMANCE_CONFIG.pose.minVisibility) {
      return null;
    }

    const world = this.worldFilter.next(rawWorld);
    const image = this.imageFilter.next(rawImage);
    const display = imageToDisplayCanvas(image, canvas);
    const deltaMs = this.previous ? sample.timestampMs - this.previous.timestampMs : 0;
    const frameGap =
      !!this.previous &&
      (deltaMs <= 0 || deltaMs > PERFORMANCE_CONFIG.phase3.head.maxFrameGapMs);
    const rawJump = this.previous ? distance3(this.previous.world, world) : 0;
    const landmarkJump = rawJump > PERFORMANCE_CONFIG.phase3.head.landmarkJumpM;
    const measuredVelocity =
      this.previous && !frameGap && !landmarkJump
        ? velocityMps(this.previous.world, world, deltaMs)
        : 0;
    const displacementFromNeutralM = neutralWorld ? distance3(world, neutralWorld) : 0;

    const observation: HeadObservation = {
      timestampMs: sample.timestampMs,
      world,
      image,
      display,
      previousDisplay: this.previous?.display,
      velocityMps: measuredVelocity,
      displacementFromGuardM: displacementFromNeutralM,
      displacementDeltaM: this.previous
        ? displacementFromNeutralM - this.previous.displacementFromNeutralM
        : 0,
      confidence,
      frameGap,
      landmarkJump,
    };

    this.previous = {
      timestampMs: sample.timestampMs,
      world,
      display,
      displacementFromNeutralM,
    };
    this.history.push(observation);
    const cutoff = sample.timestampMs - PERFORMANCE_CONFIG.motion.historyWindowMs;
    while (this.history.length > 0 && this.history[0].timestampMs < cutoff) {
      this.history.shift();
    }
    return observation;
  }

  getHistory(): readonly HeadHistoryPoint[] {
    return this.history;
  }

  reset(): void {
    this.worldFilter.reset();
    this.imageFilter.reset();
    this.previous = null;
    this.history = [];
  }
}
