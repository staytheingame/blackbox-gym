import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { imageToDisplayCanvas, type CanvasSize } from "./coordinates";
import { EmaVec3Filter } from "./smoothing";
import { distance3 } from "./vectorMath";
import type {
  CalibrationSnapshot,
  Hand,
  PoseSample,
  Vec3,
  WristHistoryPoint,
  WristObservation,
} from "./types";

export function velocityMps(previous: Vec3, current: Vec3, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  return distance3(previous, current) / (deltaMs / 1_000);
}

const valueForHand = <T>(left: T | undefined, right: T | undefined, hand: Hand) =>
  hand === "left" ? left : right;

export class WristMotionTracker {
  private readonly worldFilter = new EmaVec3Filter(PERFORMANCE_CONFIG.motion.emaAlpha);
  private readonly imageFilter = new EmaVec3Filter(PERFORMANCE_CONFIG.motion.emaAlpha);
  private previous: {
    timestampMs: number;
    world: Vec3;
    display: { x: number; y: number };
    displacementFromGuardM: number;
  } | null = null;
  private history: WristHistoryPoint[] = [];

  constructor(private readonly hand: Hand) {}

  update(
    sample: PoseSample,
    calibration: CalibrationSnapshot | null,
    canvas: CanvasSize,
  ): WristObservation | null {
    const rawWorld = valueForHand(sample.world.leftWrist, sample.world.rightWrist, this.hand);
    const rawImage = valueForHand(sample.image.leftWrist, sample.image.rightWrist, this.hand);
    const confidence = valueForHand(
      sample.visibility.leftWrist,
      sample.visibility.rightWrist,
      this.hand,
    );

    // `confidence` undefined ise landmark hiç görülmemiş demektir; `undefined <
    // sayı` her zaman false döndüğü için açıkça elemek gerekiyor — yoksa
    // görünmeyen bilek geçerli örnek sayılır.
    if (
      !rawWorld ||
      !rawImage ||
      confidence === undefined ||
      confidence < PERFORMANCE_CONFIG.pose.minVisibility
    ) {
      return null;
    }

    const world = this.worldFilter.next(rawWorld);
    const image = this.imageFilter.next(rawImage);
    const display = imageToDisplayCanvas(image, canvas);
    const deltaMs = this.previous ? sample.timestampMs - this.previous.timestampMs : 0;
    const frameGap =
      !!this.previous &&
      (deltaMs <= 0 || deltaMs > PERFORMANCE_CONFIG.motion.maxFrameGapMs);
    const rawJump = this.previous ? distance3(this.previous.world, world) : 0;
    const landmarkJump = rawJump > PERFORMANCE_CONFIG.motion.landmarkJumpM;
    const measuredVelocity =
      this.previous && !frameGap && !landmarkJump
        ? velocityMps(this.previous.world, world, deltaMs)
        : 0;
    const guard = calibration
      ? this.hand === "left"
        ? calibration.leftGuardWorld
        : calibration.rightGuardWorld
      : world;
    const displacementFromGuardM = distance3(world, guard);

    const observation: WristObservation = {
      hand: this.hand,
      timestampMs: sample.timestampMs,
      world,
      image,
      display,
      previousDisplay: this.previous?.display,
      velocityMps: measuredVelocity,
      displacementFromGuardM,
      displacementDeltaM: this.previous
        ? displacementFromGuardM - this.previous.displacementFromGuardM
        : 0,
      confidence,
      frameGap,
      landmarkJump,
    };

    this.previous = {
      timestampMs: sample.timestampMs,
      world,
      display,
      displacementFromGuardM,
    };
    this.history.push(observation);
    const cutoff = sample.timestampMs - PERFORMANCE_CONFIG.motion.historyWindowMs;
    while (this.history.length > 0 && this.history[0].timestampMs < cutoff) {
      this.history.shift();
    }
    return observation;
  }

  getHistory(): readonly WristHistoryPoint[] {
    return this.history;
  }

  reset(): void {
    this.worldFilter.reset();
    this.imageFilter.reset();
    this.previous = null;
    this.history = [];
  }
}

export function velocitiesBetween(
  history: readonly WristHistoryPoint[],
  fromMs: number,
  toMs: number,
): number[] {
  return history
    .filter((point) => point.timestampMs >= fromMs && point.timestampMs <= toMs)
    .map((point) => point.velocityMps)
    .filter(Number.isFinite);
}
