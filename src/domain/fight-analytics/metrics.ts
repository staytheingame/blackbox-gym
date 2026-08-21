/**
 * Kong Academy'nin `FightAnalyticsDashboard.tsx` (MediaPipe PoseLandmarker
 * tabanlı, tamamen tarayıcı içi) desenine dayanan, basitleştirilmiş bir
 * metrik motoru. Bu bir "tahmin/yaklaşık" motorudur — Kong'un çok
 * bileşenli Python analyzer'larının (guard_analyzer.py vb.) birebir
 * karşılığı değildir. Saf fonksiyonlar: girdi ham pose landmark kareleri,
 * çıktı sayısal bir rapor. MediaPipe/DOM/video'ya bağımlı değildir.
 */

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type PoseFrame = {
  timestampMs: number;
  /** MediaPipe Pose (BlazePose) 33 landmark dizisi. */
  landmarks: PoseLandmark[] | null;
};

// BlazePose / MediaPipe Pose landmark indeksleri (33 nokta modeli).
const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

const MIN_VISIBILITY = 0.3;

function isVisible(point: PoseLandmark | undefined): point is PoseLandmark {
  if (!point) return false;
  return point.visibility === undefined || point.visibility >= MIN_VISIBILITY;
}

function hasKeyLandmarks(landmarks: PoseLandmark[] | null): landmarks is PoseLandmark[] {
  if (!landmarks || landmarks.length < 29) return false;
  return [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP]
    .every((index) => isVisible(landmarks[index]));
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const distance = (a: PoseLandmark, b: PoseLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export type FightAnalysisReport = {
  personDetected: boolean;
  frameCount: number;
  validFrameCount: number;
  durationSec: number;
  guardScore: number;
  guardDropFrameRatio: number;
  footworkScore: number;
  movementIndex: number;
  headSlipCount: number;
  headActivityScore: number;
  stanceRatio: number;
  overallScore: number;
};

const EMPTY_REPORT: FightAnalysisReport = {
  personDetected: false,
  frameCount: 0,
  validFrameCount: 0,
  durationSec: 0,
  guardScore: 0,
  guardDropFrameRatio: 0,
  footworkScore: 0,
  movementIndex: 0,
  headSlipCount: 0,
  headActivityScore: 0,
  stanceRatio: 0,
  overallScore: 0,
};

export function analyzeFightFrames(frames: PoseFrame[]): FightAnalysisReport {
  const validFrames = frames.filter((frame) => hasKeyLandmarks(frame.landmarks));

  if (frames.length === 0 || validFrames.length / Math.max(frames.length, 1) < 0.1) {
    return {
      ...EMPTY_REPORT,
      frameCount: frames.length,
      validFrameCount: validFrames.length,
      durationSec: durationOf(frames),
    };
  }

  // --- Guard: bilekler göğüs hizasının altına düşüyor mu? ---
  let guardDropFrames = 0;
  for (const frame of validFrames) {
    const lm = frame.landmarks as PoseLandmark[];
    const nose = lm[NOSE];
    const hipMidY = (lm[LEFT_HIP].y + lm[RIGHT_HIP].y) / 2;
    const chestLineY = nose.y + (hipMidY - nose.y) * 0.6;
    const leftDropped = lm[LEFT_WRIST].y > chestLineY;
    const rightDropped = lm[RIGHT_WRIST].y > chestLineY;
    if (leftDropped || rightDropped) guardDropFrames += 1;
  }
  const guardDropFrameRatio = guardDropFrames / validFrames.length;
  const guardScore = Math.round(clamp(100 * (1 - guardDropFrameRatio)));

  // --- Ayak işi: ayak bileği orta noktasının kare-kare yer değiştirmesi ---
  let totalAnkleMovement = 0;
  let movementSamples = 0;
  for (let i = 1; i < validFrames.length; i++) {
    const prev = validFrames[i - 1].landmarks as PoseLandmark[];
    const curr = validFrames[i].landmarks as PoseLandmark[];
    if (!isVisible(prev[LEFT_ANKLE]) || !isVisible(prev[RIGHT_ANKLE])) continue;
    if (!isVisible(curr[LEFT_ANKLE]) || !isVisible(curr[RIGHT_ANKLE])) continue;
    const prevMid = midpoint(prev[LEFT_ANKLE], prev[RIGHT_ANKLE]);
    const currMid = midpoint(curr[LEFT_ANKLE], curr[RIGHT_ANKLE]);
    totalAnkleMovement += distance(prevMid, currMid);
    movementSamples += 1;
  }
  const movementIndex =
    movementSamples > 0
      ? Number((totalAnkleMovement / movementSamples).toFixed(4))
      : 0;
  // 0.02 normalize birim/kare hayli hareketli kabul edilir (deneysel eşik).
  const footworkScore = Math.round(clamp((movementIndex / 0.02) * 100));

  // --- Kafa hareketi: burun x konumunun yön değişim sayısı ---
  let headSlipCount = 0;
  let lastDirection: number | null = null;
  const SLIP_THRESHOLD = 0.01;
  for (let i = 1; i < validFrames.length; i++) {
    const prevNose = (validFrames[i - 1].landmarks as PoseLandmark[])[NOSE];
    const currNose = (validFrames[i].landmarks as PoseLandmark[])[NOSE];
    const deltaX = currNose.x - prevNose.x;
    if (Math.abs(deltaX) < SLIP_THRESHOLD) continue;
    const direction = Math.sign(deltaX);
    if (lastDirection !== null && direction !== lastDirection) {
      headSlipCount += 1;
    }
    lastDirection = direction;
  }
  const durationSec = durationOf(frames);
  const slipsPerMinute = durationSec > 0 ? headSlipCount / (durationSec / 60) : 0;
  const headActivityScore = Math.round(clamp(slipsPerMinute * 5));

  // --- Duruş genişliği: ayak açıklığı / omuz genişliği ---
  const stanceRatios: number[] = [];
  for (const frame of validFrames) {
    const lm = frame.landmarks as PoseLandmark[];
    if (!isVisible(lm[LEFT_ANKLE]) || !isVisible(lm[RIGHT_ANKLE])) continue;
    const shoulderWidth = Math.abs(lm[LEFT_SHOULDER].x - lm[RIGHT_SHOULDER].x);
    if (shoulderWidth < 1e-4) continue;
    const ankleWidth = Math.abs(lm[LEFT_ANKLE].x - lm[RIGHT_ANKLE].x);
    stanceRatios.push(ankleWidth / shoulderWidth);
  }
  const stanceRatio =
    stanceRatios.length > 0
      ? Number(
          (stanceRatios.reduce((sum, v) => sum + v, 0) / stanceRatios.length).toFixed(2),
        )
      : 0;

  const overallScore = Math.round(
    clamp(guardScore * 0.4 + footworkScore * 0.35 + headActivityScore * 0.25),
  );

  return {
    personDetected: true,
    frameCount: frames.length,
    validFrameCount: validFrames.length,
    durationSec,
    guardScore,
    guardDropFrameRatio: Number(guardDropFrameRatio.toFixed(2)),
    footworkScore,
    movementIndex,
    headSlipCount,
    headActivityScore,
    stanceRatio,
    overallScore,
  };
}

function midpoint(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function durationOf(frames: PoseFrame[]): number {
  if (frames.length < 2) return 0;
  const first = frames[0].timestampMs;
  const last = frames[frames.length - 1].timestampMs;
  return Number(((last - first) / 1000).toFixed(1));
}
