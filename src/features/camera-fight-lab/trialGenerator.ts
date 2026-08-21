import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { clamp } from "./vectorMath";
import { imageToDisplayCanvas, withDisplayMirror, type CanvasSize } from "./coordinates";
import type { CalibrationSnapshot, Hand, TargetSnapshot, Vec2 } from "./types";

export type Rng = () => number;

export function randomDelayMs(rng: Rng = Math.random): number {
  const min = PERFORMANCE_CONFIG.target.randomDelayMinMs;
  const max = PERFORMANCE_CONFIG.target.randomDelayMaxMs;
  return Math.round(min + clamp(rng(), 0, 0.999999) * (max - min));
}

function baseRadiusNormalized(shoulderWidthNormalized: number): number {
  return clamp(
    shoulderWidthNormalized * PERFORMANCE_CONFIG.target.radiusShoulderRatio,
    PERFORMANCE_CONFIG.target.minRadiusNormalized,
    PERFORMANCE_CONFIG.target.maxRadiusNormalized,
  );
}

export function createTarget(
  calibration: CalibrationSnapshot,
  canvas: CanvasSize,
  previousZoneIndex: number | null,
  rng: Rng = Math.random,
): TargetSnapshot {
  const zones = PERFORMANCE_CONFIG.target.zones;
  const candidates = zones
    .map((zone, index) => ({ zone, index }))
    .filter(({ index }) => zones.length < 2 || index !== previousZoneIndex);
  const selected =
    candidates[Math.min(Math.floor(clamp(rng(), 0, 0.999999) * candidates.length), candidates.length - 1)];
  const torso = withDisplayMirror(calibration.torsoCenterImage);
  const shoulderWidth = calibration.shoulderWidthNormalized;
  const margin = PERFORMANCE_CONFIG.target.viewportMarginNormalized;
  const normalizedX = clamp(torso.x + selected.zone.x * shoulderWidth, margin, 1 - margin);
  const normalizedY = clamp(torso.y + selected.zone.y * shoulderWidth, margin, 1 - margin);
  const radiusNormalized = baseRadiusNormalized(shoulderWidth);

  return {
    displayX: normalizedX * canvas.width,
    displayY: normalizedY * canvas.height,
    normalizedX,
    normalizedY,
    radiusPx: radiusNormalized * canvas.width,
    radiusNormalized,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    zoneIndex: selected.index,
  };
}

export function createPeripheralTarget(
  calibration: CalibrationSnapshot,
  canvas: CanvasSize,
  zone: (typeof PERFORMANCE_CONFIG.decision.peripheralZones)[number],
): TargetSnapshot {
  const torso = withDisplayMirror(calibration.torsoCenterImage);
  const margin = PERFORMANCE_CONFIG.target.viewportMarginNormalized;
  const normalizedX = clamp(
    torso.x + zone.xShoulderWidths * calibration.shoulderWidthNormalized,
    margin,
    1 - margin,
  );
  const normalizedY = clamp(
    torso.y - calibration.shoulderWidthNormalized * 0.38,
    margin,
    1 - margin,
  );
  const radiusNormalized = baseRadiusNormalized(calibration.shoulderWidthNormalized);
  const zoneIndex = PERFORMANCE_CONFIG.decision.peripheralZones.findIndex(
    (candidate) => candidate.id === zone.id,
  );

  return {
    displayX: normalizedX * canvas.width,
    displayY: normalizedY * canvas.height,
    normalizedX,
    normalizedY,
    radiusPx: radiusNormalized * canvas.width,
    radiusNormalized,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    zoneIndex,
  };
}

/**
 * Defense-reflex trial'ları için görsel "gelen darbe" işareti. Hedef fiziksel
 * olarak vurulmaz — yalnız sporcunun neyden kaçındığını gösterir; kaçınma
 * ölçümü baş hareketiyle (headMotion) yapılır.
 */
export function createDefenseCueTarget(
  calibration: CalibrationSnapshot,
  canvas: CanvasSize,
): TargetSnapshot {
  const head = withDisplayMirror(calibration.headNeutralImage);
  const radiusNormalized = baseRadiusNormalized(calibration.shoulderWidthNormalized) * 0.7;
  return {
    displayX: head.x * canvas.width,
    displayY: head.y * canvas.height,
    normalizedX: head.x,
    normalizedY: head.y,
    radiusPx: radiusNormalized * canvas.width,
    radiusNormalized,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    zoneIndex: -1,
  };
}

/** Kalibre edilmiş nötr baş pozisyonunun o anki canvas boyutuna göre aynalanmış display koordinatı. */
export function headNeutralDisplayPoint(
  calibration: CalibrationSnapshot,
  canvas: CanvasSize,
): Vec2 {
  return imageToDisplayCanvas(calibration.headNeutralImage, canvas);
}

export type GuardZoneSnapshot = {
  hand: Hand;
  displayX: number;
  displayY: number;
  radiusPx: number;
};

/** Kalibre edilmiş guard noktasının, o anki canvas boyutuna göre aynalanmış display koordinatı. */
export function createGuardZone(
  calibration: CalibrationSnapshot,
  canvas: CanvasSize,
  hand: Hand,
): GuardZoneSnapshot {
  const guardImage = hand === "left" ? calibration.leftGuardImage : calibration.rightGuardImage;
  const mirrored = withDisplayMirror(guardImage);
  const radiusNormalized =
    baseRadiusNormalized(calibration.shoulderWidthNormalized) *
    PERFORMANCE_CONFIG.phase2.guardReturnZoneRadiusRatio;
  return {
    hand,
    displayX: mirrored.x * canvas.width,
    displayY: mirrored.y * canvas.height,
    radiusPx: radiusNormalized * canvas.width,
  };
}

export function scaleTarget(target: TargetSnapshot, canvas: CanvasSize): TargetSnapshot {
  return {
    ...target,
    displayX: target.normalizedX * canvas.width,
    displayY: target.normalizedY * canvas.height,
    radiusPx: target.radiusNormalized * canvas.width,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  };
}
