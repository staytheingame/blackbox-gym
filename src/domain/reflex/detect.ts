/**
 * Kamera doğrulaması için saf hareket-çözümleme katmanı.
 *
 * Girdi: MediaPipe PoseLandmarker'ın verdiği 33 noktalı iskelet kareleri.
 * Çıktı: "hareket ne zaman başladı", "istenen hamle yapıldı mı", "yanlış
 * hamle mi geldi" sorularının sayısal cevabı. DOM/MediaPipe/React'e
 * bağımlı değildir — tamamen test edilebilir.
 *
 * Tüm mesafeler gövde boyuna (omuz ortası ↔ kalça ortası) bölünerek
 * normalize edilir; kişinin kameraya uzaklığı sonucu değiştirmez.
 */

import type { PoseLandmark } from "@/domain/fight-analytics/metrics";
import { REFLEX_MOVES, type ReflexMove } from "./moves";

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

const MIN_VISIBILITY = 0.35;
const MIN_TORSO = 0.05; // normalize birim; bundan küçükse kişi çok uzakta/hatalı

export type Point = { x: number; y: number };

export type PoseFeatures = {
  tMs: number;
  /** Omuz ortası ↔ kalça ortası uzaklığı — ölçek birimi. */
  torso: number;
  nose: Point;
  leftWrist: Point;
  rightWrist: Point;
  shoulderMid: Point;
  hipMid: Point;
  shoulderWidth: number;
  /** Görüntüde kişinin "sol"unun hangi yönde olduğu: +1 => +x. */
  leftSign: 1 | -1;
  /** İki bilek de omuz hizasının üstünde mi (guard). */
  guardUp: boolean;
};

const visible = (point: PoseLandmark | undefined): point is PoseLandmark =>
  !!point && (point.visibility === undefined || point.visibility >= MIN_VISIBILITY);

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Ham landmark dizisinden ölçüm alınabilir bir kare üretir; olmuyorsa null. */
export function extractFeatures(
  landmarks: PoseLandmark[] | null | undefined,
  tMs: number,
): PoseFeatures | null {
  if (!landmarks || landmarks.length < 25) return null;
  const required = [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP];
  if (!required.every((index) => visible(landmarks[index]))) return null;

  const shoulderMid = mid(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER]);
  const hipMid = mid(landmarks[LEFT_HIP], landmarks[RIGHT_HIP]);
  const torso = dist(shoulderMid, hipMid);
  if (torso < MIN_TORSO) return null;

  // Bilek görünmüyorsa omuz konumunu vekil olarak kullan (hareket sinyali 0 olur).
  const leftWrist = visible(landmarks[LEFT_WRIST])
    ? { x: landmarks[LEFT_WRIST].x, y: landmarks[LEFT_WRIST].y }
    : { x: landmarks[LEFT_SHOULDER].x, y: landmarks[LEFT_SHOULDER].y };
  const rightWrist = visible(landmarks[RIGHT_WRIST])
    ? { x: landmarks[RIGHT_WRIST].x, y: landmarks[RIGHT_WRIST].y }
    : { x: landmarks[RIGHT_SHOULDER].x, y: landmarks[RIGHT_SHOULDER].y };

  return {
    tMs,
    torso,
    nose: { x: landmarks[NOSE].x, y: landmarks[NOSE].y },
    leftWrist,
    rightWrist,
    shoulderMid,
    hipMid,
    shoulderWidth: Math.abs(landmarks[LEFT_SHOULDER].x - landmarks[RIGHT_SHOULDER].x),
    leftSign: landmarks[LEFT_SHOULDER].x >= landmarks[RIGHT_SHOULDER].x ? 1 : -1,
    guardUp:
      leftWrist.y < shoulderMid.y + torso * 0.15 &&
      rightWrist.y < shoulderMid.y + torso * 0.15,
  };
}

export type Baseline = PoseFeatures;

/** Komut öncesi karelerin ortalaması — hareketin kıyaslanacağı "duruş". */
export function averageFeatures(frames: PoseFeatures[]): Baseline | null {
  if (frames.length === 0) return null;
  const n = frames.length;
  const sum = (pick: (f: PoseFeatures) => number) =>
    frames.reduce((total, f) => total + pick(f), 0) / n;
  const point = (pick: (f: PoseFeatures) => Point): Point => ({
    x: sum((f) => pick(f).x),
    y: sum((f) => pick(f).y),
  });

  return {
    tMs: frames[n - 1].tMs,
    torso: sum((f) => f.torso),
    nose: point((f) => f.nose),
    leftWrist: point((f) => f.leftWrist),
    rightWrist: point((f) => f.rightWrist),
    shoulderMid: point((f) => f.shoulderMid),
    hipMid: point((f) => f.hipMid),
    shoulderWidth: sum((f) => f.shoulderWidth),
    leftSign: frames[n - 1].leftSign,
    guardUp: frames.filter((f) => f.guardUp).length / n >= 0.5,
  };
}

/** Bir karedeki toplam hareket enerjisi (gövde boyu birimi). */
export function motionEnergy(baseline: Baseline, frame: PoseFeatures): number {
  const scale = baseline.torso || 1;
  return (
    Math.max(
      dist(frame.nose, baseline.nose),
      dist(frame.leftWrist, baseline.leftWrist),
      dist(frame.rightWrist, baseline.rightWrist),
      dist(frame.shoulderMid, baseline.shoulderMid),
    ) / scale
  );
}

/**
 * Bir hamlenin ne kadar yapıldığı: 0 = hiç, 1 = eşiği tam karşıladı.
 * Yön hatalıysa (sol yerine sağ) değer 0'a yakın kalır.
 */
export function moveProgress(
  baseline: Baseline,
  frame: PoseFeatures,
  move: ReflexMove,
): number {
  const scale = baseline.torso || 1;
  const lateral = ((frame.nose.x - baseline.nose.x) * baseline.leftSign) / scale; // + => kişinin soluna
  const vertical = (frame.nose.y - baseline.nose.y) / scale; // + => aşağı
  const bodyDrop = (frame.shoulderMid.y - baseline.shoulderMid.y) / scale;
  const bodyRise = (baseline.hipMid.y - frame.hipMid.y) / scale;
  const wantLeft = move.side === "sol";

  switch (move.signal) {
    case "punch": {
      const wrist = wantLeft ? frame.leftWrist : frame.rightWrist;
      const base = wantLeft ? baseline.leftWrist : baseline.rightWrist;
      const other = wantLeft ? frame.rightWrist : frame.leftWrist;
      const otherBase = wantLeft ? baseline.rightWrist : baseline.leftWrist;
      const travel = dist(wrist, base) / scale;
      const otherTravel = dist(other, otherBase) / scale;
      // Doğru elin hareketi baskın olmalı — iki el birden savrulursa puan düşer.
      const dominance = travel > otherTravel ? 1 : 0.45;
      return (travel / move.threshold) * dominance;
    }
    case "slip": {
      const signed = wantLeft ? lateral : -lateral;
      return signed / move.threshold;
    }
    case "roll": {
      const signed = wantLeft ? lateral : -lateral;
      const drop = Math.max(vertical, bodyDrop);
      // Roll = aynı anda çökme + yana savurma; ikisinin zayıf halkası belirler.
      return Math.min(drop / move.threshold, signed / (move.threshold * 0.8));
    }
    case "duck": {
      const drop = Math.max(vertical, bodyDrop);
      return drop / move.threshold;
    }
    case "jump": {
      const rise = Math.max(bodyRise, (baseline.shoulderMid.y - frame.shoulderMid.y) / scale);
      return rise / move.threshold;
    }
    case "retreat": {
      // Kameradan uzaklaşınca iskelet küçülür; omuz genişliği referans.
      const shrink =
        baseline.shoulderWidth > 0
          ? (baseline.shoulderWidth - frame.shoulderWidth) / baseline.shoulderWidth
          : 0;
      const torsoShrink = baseline.torso > 0 ? (baseline.torso - frame.torso) / baseline.torso : 0;
      return Math.max(shrink, torsoShrink) / move.threshold;
    }
    case "guard": {
      const leftRise = (baseline.leftWrist.y - frame.leftWrist.y) / scale;
      const rightRise = (baseline.rightWrist.y - frame.rightWrist.y) / scale;
      const rise = Math.min(leftRise, rightRise); // iki el birden kalkmalı
      const upNow = frame.guardUp ? 1 : 0.7;
      return (rise / move.threshold) * upNow;
    }
    default:
      return 0;
  }
}

export type DetectionResult = {
  /** Hareketin başladığı an (komuttan itibaren ms) — asıl tepki süresi. */
  onsetMs: number | null;
  /** Hamlenin eşiği aştığı an (komuttan itibaren ms) — hamle tamamlanma süresi. */
  completionMs: number | null;
  /** İstenen hamle doğrulandı mı. */
  matched: boolean;
  /** İstenen hamle 0..1 güven. */
  confidence: number;
  /** İstenen hamlenin ulaştığı en yüksek oran. */
  peakProgress: number;
  /** Kamera farklı bir hamle gördüyse onun id'si. */
  detectedMoveId: string | null;
  /** Ölçüm yapılabilen kare sayısı. */
  sampleCount: number;
};

const EMPTY_DETECTION: DetectionResult = {
  onsetMs: null,
  completionMs: null,
  matched: false,
  confidence: 0,
  peakProgress: 0,
  detectedMoveId: null,
  sampleCount: 0,
};

export const ONSET_ENERGY = 0.07;

/**
 * Komut anından itibaren biriken kareleri değerlendirir.
 * `frames` yalnızca cue sonrası kareleri içermelidir.
 */
export function detectReaction(
  baseline: Baseline | null,
  frames: PoseFeatures[],
  move: ReflexMove,
  cueTimeMs: number,
  onsetEnergy: number = ONSET_ENERGY,
): DetectionResult {
  if (!baseline || frames.length === 0) {
    return { ...EMPTY_DETECTION, sampleCount: frames.length };
  }

  let onsetMs: number | null = null;
  let completionMs: number | null = null;
  let peakProgress = 0;
  const peakByMove = new Map<string, number>();

  for (const frame of frames) {
    const elapsed = frame.tMs - cueTimeMs;
    if (elapsed < 0) continue;

    if (onsetMs === null && motionEnergy(baseline, frame) >= onsetEnergy) {
      onsetMs = Math.round(elapsed);
    }

    const progress = moveProgress(baseline, frame, move);
    if (progress > peakProgress) peakProgress = progress;
    if (completionMs === null && progress >= 1) completionMs = Math.round(elapsed);

    for (const candidate of REFLEX_MOVES) {
      if (candidate.id === move.id) continue;
      const value = moveProgress(baseline, frame, candidate);
      if (value > (peakByMove.get(candidate.id) ?? 0)) peakByMove.set(candidate.id, value);
    }
  }

  const matched = completionMs !== null;
  let detectedMoveId: string | null = null;
  if (!matched) {
    let bestId: string | null = null;
    let bestValue = 1; // yanlış hamle de eşiği aşmış olmalı
    for (const [id, value] of peakByMove) {
      if (value > bestValue) {
        bestValue = value;
        bestId = id;
      }
    }
    detectedMoveId = bestId;
  }

  return {
    onsetMs,
    completionMs,
    matched,
    confidence: clamp01(peakProgress / 1.5),
    peakProgress: Number(peakProgress.toFixed(2)),
    detectedMoveId,
    sampleCount: frames.length,
  };
}

/** Verilen aralıktaki kareleri süzer (dahil: [fromMs, toMs]). */
export function framesBetween(
  frames: PoseFeatures[],
  fromMs: number,
  toMs: number,
): PoseFeatures[] {
  return frames.filter((frame) => frame.tMs >= fromMs && frame.tMs <= toMs);
}

/** Bekleme fazında guard'ın yukarıda kaldığı kare oranı (0..1). */
export function guardUpRatio(frames: PoseFeatures[]): number | null {
  if (frames.length === 0) return null;
  return Number((frames.filter((frame) => frame.guardUp).length / frames.length).toFixed(2));
}
