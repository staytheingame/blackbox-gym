import {
  REFLEX_MOVES,
  type Difficulty,
  type ReflexMove,
  DIFFICULTY_INTERVAL_MS,
} from "./moves";

export type Rng = () => number; // [0, 1)

/** Bir önceki hamleyle aynısını vermeyen rastgele hamle seçer. */
export function pickNextMove(
  previousId: string | null,
  rng: Rng = Math.random,
): ReflexMove {
  const candidates = previousId
    ? REFLEX_MOVES.filter((move) => move.id !== previousId)
    : REFLEX_MOVES;
  const index = Math.floor(rng() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Zorluk seviyesine göre rastgele bekleme süresi (ms). */
export function pickIntervalMs(difficulty: Difficulty, rng: Rng = Math.random): number {
  const [min, max] = DIFFICULTY_INTERVAL_MS[difficulty];
  return Math.round(min + rng() * (max - min));
}

export type ReflexRep = {
  moveId: string;
  reactionMs: number;
  /** 0 tabanlı round numarası. */
  roundIndex?: number;
  /** Kamera modunda hamle iskeletle doğrulandı mı. */
  verified?: boolean;
  /** Kamera farklı bir hamle gördüyse. */
  detectedMoveId?: string | null;
  /** Hamlenin tamamlanma süresi (komuttan itibaren ms). */
  completionMs?: number | null;
  /** 0..1 doğrulama güveni. */
  confidence?: number;
  /** Süre dolmasına rağmen hareket görülmedi. */
  missed?: boolean;
  /** Komut öncesi bekleme fazında guard'ın yukarıda kaldığı oran (0..1). */
  guardUpRatio?: number | null;
};

export type MoveStat = {
  moveId: string;
  label: string;
  count: number;
  averageMs: number;
};

export type ReflexSummary = {
  repCount: number;
  averageMs: number;
  bestMs: number;
  worstMs: number;
  perMove: MoveStat[];
};

const moveLabel = (moveId: string): string =>
  REFLEX_MOVES.find((move) => move.id === moveId)?.label ?? moveId;

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const round = (value: number) => Math.round(value);

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

/** Zaman istatistiklerine yalnızca gerçekten tepki verilen tekrarlar girer. */
const timedReps = (reps: ReflexRep[]) => reps.filter((rep) => !rep.missed);

export function summarizeSession(reps: ReflexRep[]): ReflexSummary {
  const scored = timedReps(reps);
  if (scored.length === 0) {
    return { repCount: reps.length, averageMs: 0, bestMs: 0, worstMs: 0, perMove: [] };
  }

  const times = scored.map((rep) => rep.reactionMs);
  const averageMs = round(mean(times));

  const byMove = new Map<string, number[]>();
  for (const rep of scored) {
    const list = byMove.get(rep.moveId) ?? [];
    list.push(rep.reactionMs);
    byMove.set(rep.moveId, list);
  }

  const perMove: MoveStat[] = [...byMove.entries()]
    .map(([moveId, msList]) => ({
      moveId,
      label: moveLabel(moveId),
      count: msList.length,
      averageMs: round(mean(msList)),
    }))
    .sort((a, b) => a.averageMs - b.averageMs);

  return {
    repCount: scored.length,
    averageMs,
    bestMs: Math.min(...times),
    worstMs: Math.max(...times),
    perMove,
  };
}

// --- Round tabanlı odak analizi ---

export type SessionMode = "manuel" | "kamera";

export type RoundReport = {
  roundIndex: number;
  cueCount: number;
  hitCount: number;
  missCount: number;
  wrongMoveCount: number;
  averageMs: number;
  bestMs: number;
  worstMs: number;
  medianMs: number;
  stdDevMs: number;
  /** Round içindeki ikinci yarı - ilk yarı farkı (ms). + = yavaşlama. */
  fatigueDriftMs: number;
  speedScore: number;
  consistencyScore: number;
  /** Kamera modunda doğru hamle oranı; manuel modda null. */
  accuracyScore: number | null;
  /** Kamera modunda guard disiplini; manuel modda null. */
  guardScore: number | null;
  enduranceScore: number;
  focusScore: number;
  perMove: MoveStat[];
};

export type SessionReport = {
  mode: SessionMode;
  rounds: RoundReport[];
  overall: RoundReport;
  bestRoundIndex: number | null;
  worstRoundIndex: number | null;
  focusScore: number;
  focusTrend: "yukselen" | "stabil" | "dusen";
  verdict: string;
  highlights: string[];
};

/** Ortalama tepki: 250 ms → 100, 750 ms → 0. */
function speedScoreOf(averageMs: number): number {
  if (averageMs <= 0) return 0;
  return round(clamp(((750 - averageMs) / 500) * 100));
}

/** Değişkenlik katsayısı 0 → 100, 0.45 ve üstü → 0. */
function consistencyScoreOf(averageMs: number, deviationMs: number): number {
  if (averageMs <= 0) return 0;
  const cv = deviationMs / averageMs;
  return round(clamp((1 - cv / 0.45) * 100));
}

/** 200 ms yavaşlama → 0; hızlanma → 100. */
function enduranceScoreOf(driftMs: number): number {
  return round(clamp(100 - (driftMs / 200) * 100));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

const EMPTY_ROUND = (roundIndex: number, cueCount: number): RoundReport => ({
  roundIndex,
  cueCount,
  hitCount: 0,
  missCount: cueCount,
  wrongMoveCount: 0,
  averageMs: 0,
  bestMs: 0,
  worstMs: 0,
  medianMs: 0,
  stdDevMs: 0,
  fatigueDriftMs: 0,
  speedScore: 0,
  consistencyScore: 0,
  accuracyScore: null,
  guardScore: null,
  enduranceScore: 0,
  focusScore: 0,
  perMove: [],
});

/** Bir round'un (veya tüm seansın) tam analizini üretir. */
export function buildRoundReport(
  reps: ReflexRep[],
  mode: SessionMode,
  roundIndex = 0,
): RoundReport {
  const cueCount = reps.length;
  const scored = timedReps(reps);
  if (scored.length === 0) return EMPTY_ROUND(roundIndex, cueCount);

  const times = scored.map((rep) => rep.reactionMs);
  const averageMs = round(mean(times));
  const deviationMs = round(stdDev(times));

  const half = Math.floor(times.length / 2);
  const fatigueDriftMs =
    times.length >= 4 ? round(mean(times.slice(half)) - mean(times.slice(0, half))) : 0;

  const wrongMoveCount = reps.filter(
    (rep) => !rep.missed && rep.verified === false,
  ).length;
  const missCount = reps.filter((rep) => rep.missed).length;
  const hitCount = reps.filter(
    (rep) => !rep.missed && rep.verified !== false,
  ).length;

  const guardSamples = reps
    .map((rep) => rep.guardUpRatio)
    .filter((value): value is number => typeof value === "number");

  const speedScore = speedScoreOf(averageMs);
  const consistencyScore = consistencyScoreOf(averageMs, deviationMs);
  const enduranceScore = enduranceScoreOf(fatigueDriftMs);
  const accuracyScore =
    mode === "kamera" && cueCount > 0 ? round((hitCount / cueCount) * 100) : null;
  const guardScore =
    mode === "kamera" && guardSamples.length > 0 ? round(mean(guardSamples) * 100) : null;

  const focusScore =
    mode === "kamera"
      ? round(
          speedScore * 0.3 +
            consistencyScore * 0.25 +
            (accuracyScore ?? 0) * 0.25 +
            (guardScore ?? speedScore) * 0.1 +
            enduranceScore * 0.1,
        )
      : round(speedScore * 0.45 + consistencyScore * 0.35 + enduranceScore * 0.2);

  return {
    roundIndex,
    cueCount,
    hitCount,
    missCount,
    wrongMoveCount,
    averageMs,
    bestMs: Math.min(...times),
    worstMs: Math.max(...times),
    medianMs: median(times),
    stdDevMs: deviationMs,
    fatigueDriftMs,
    speedScore,
    consistencyScore,
    accuracyScore,
    guardScore,
    enduranceScore,
    focusScore: clamp(focusScore),
    perMove: summarizeSession(reps).perMove,
  };
}

function verdictFor(focusScore: number, mode: SessionMode): string {
  if (focusScore >= 85) {
    return "Keskin seans. Tempo ve odak round boyunca yüksek kaldı — zorluğu bir kademe artır.";
  }
  if (focusScore >= 70) {
    return "Sağlam seans. Hız iyi; kazanç artık tutarlılıkta ve son round'u ilk round gibi bitirmekte.";
  }
  if (focusScore >= 50) {
    return mode === "kamera"
      ? "Orta seviye. Tepki var ama hamle kalitesi ve guard disiplini dalgalanıyor — daha az tekrarla temiz çalış."
      : "Orta seviye. Tepkiler dalgalı — daha kısa round'larla tutarlılığa odaklan.";
  }
  return "Odak dağınık. Round sayısını düşür, dinlenmeyi uzat ve hamleleri yavaş-temiz tekrar et.";
}

function highlightsFor(rounds: RoundReport[], overall: RoundReport, mode: SessionMode): string[] {
  const notes: string[] = [];

  if (rounds.length >= 2) {
    const first = rounds[0];
    const last = rounds[rounds.length - 1];
    const diff = last.averageMs - first.averageMs;
    if (diff > 40) {
      notes.push(
        `Son round ilk round'dan ${diff} ms yavaş — dayanıklılık, hızdan önce çalışılmalı.`,
      );
    } else if (diff < -40) {
      notes.push(`Isındıkça hızlandın: son round ilk round'dan ${Math.abs(diff)} ms hızlı.`);
    } else {
      notes.push("Round'lar arası hız farkı düşük — tempo dengeli.");
    }
  }

  if (overall.consistencyScore < 60) {
    notes.push(
      `Sapma ${overall.stdDevMs} ms. En hızlı (${overall.bestMs} ms) ile en yavaş (${overall.worstMs} ms) arası açık; tahmin etmeyi bırakıp komutu bekle.`,
    );
  }

  if (mode === "kamera") {
    if (overall.wrongMoveCount > 0) {
      notes.push(
        `${overall.wrongMoveCount} tekrarda kamera farklı bir hamle gördü — komut ayrımı (sol/sağ, roll/slip) zayıf.`,
      );
    }
    if (overall.missCount > 0) {
      notes.push(`${overall.missCount} komutta zamanında hareket algılanmadı.`);
    }
    if (overall.guardScore !== null && overall.guardScore < 70) {
      notes.push(
        `Komutlar arası guard yalnızca %${overall.guardScore} oranında yukarıdaydı — eller düşüyor.`,
      );
    }
  }

  const slowest = [...overall.perMove].sort((a, b) => b.averageMs - a.averageMs)[0];
  const fastest = overall.perMove[0];
  if (slowest && fastest && slowest.moveId !== fastest.moveId) {
    notes.push(
      `En yavaş hamle: ${slowest.label} (${slowest.averageMs} ms) · En hızlı: ${fastest.label} (${fastest.averageMs} ms).`,
    );
  }

  return notes.slice(0, 5);
}

/** Tüm seansın round bazlı odak raporu. */
export function analyzeSession(reps: ReflexRep[], mode: SessionMode): SessionReport {
  const byRound = new Map<number, ReflexRep[]>();
  for (const rep of reps) {
    const index = rep.roundIndex ?? 0;
    const list = byRound.get(index) ?? [];
    list.push(rep);
    byRound.set(index, list);
  }

  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, roundReps]) => buildRoundReport(roundReps, mode, index));

  const overall = buildRoundReport(reps, mode, -1);

  const ranked = [...rounds].sort((a, b) => b.focusScore - a.focusScore);
  const bestRoundIndex = ranked.length > 0 ? ranked[0].roundIndex : null;
  const worstRoundIndex = ranked.length > 1 ? ranked[ranked.length - 1].roundIndex : null;

  let focusTrend: SessionReport["focusTrend"] = "stabil";
  if (rounds.length >= 2) {
    const delta = rounds[rounds.length - 1].focusScore - rounds[0].focusScore;
    if (delta > 5) focusTrend = "yukselen";
    else if (delta < -5) focusTrend = "dusen";
  }

  return {
    mode,
    rounds,
    overall,
    bestRoundIndex,
    worstRoundIndex,
    focusScore: overall.focusScore,
    focusTrend,
    verdict: verdictFor(overall.focusScore, mode),
    highlights: highlightsFor(rounds, overall, mode),
  };
}
