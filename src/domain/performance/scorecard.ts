import type {
  CheckInAnswers,
  CheckInRecord,
  MemberScorecard,
  ScorePillars,
} from "./types";

/**
 * Kong Academy'nin `scorecard.ts` motorundan uyarlandı: check-in cevaplarından
 * 0-100 aralığında süreç puanları + ağırlıklı genel skor üretir. Saf fonksiyon,
 * veritabanından bağımsız — girdi geçmiş check-in listesi, çıktı skor kartı.
 */

const WEIGHTS: Record<keyof ScorePillars, number> = {
  training: 0.3,
  sleep: 0.2,
  stress: 0.2,
  energy: 0.15,
  enjoyment: 0.15,
  consistency: 0, // genel skora dahil değil; ayrı bilgi amaçlı gösterilir
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const scaleOneToFive = (value: number) => clamp(((value - 1) / 4) * 100);

function computePillars(
  answers: CheckInAnswers,
  consistency: number,
): ScorePillars {
  const trainingScore =
    answers.plannedSessions > 0
      ? clamp((answers.completedSessions / answers.plannedSessions) * 100)
      : 0;

  return {
    training: Math.round(trainingScore),
    sleep: Math.round(scaleOneToFive(answers.sleepQuality)),
    // stres 1(düşük)-5(yüksek): skor için ters çevrilir, düşük stres = yüksek skor
    stress: Math.round(scaleOneToFive(6 - answers.stressLevel)),
    energy: Math.round(scaleOneToFive(answers.energyLevel)),
    enjoyment: Math.round(scaleOneToFive(answers.enjoyment)),
    consistency: Math.round(consistency),
  };
}

function computeOverallScore(pillars: ScorePillars): number {
  const weightedSum =
    pillars.training * WEIGHTS.training +
    pillars.sleep * WEIGHTS.sleep +
    pillars.stress * WEIGHTS.stress +
    pillars.energy * WEIGHTS.energy +
    pillars.enjoyment * WEIGHTS.enjoyment;
  return Math.round(weightedSum);
}

/** Son 4 check-in penceresinde kaçı dolduruldu (0-100). */
function computeConsistency(history: CheckInRecord[]): number {
  const windowSize = 4;
  const recentCount = Math.min(history.length, windowSize);
  if (recentCount === 0) return 0;
  return (recentCount / windowSize) * 100;
}

export function computeMemberScorecard(
  history: CheckInRecord[],
): MemberScorecard {
  if (history.length === 0) {
    return {
      pillars: {
        training: 0,
        sleep: 0,
        stress: 0,
        energy: 0,
        enjoyment: 0,
        consistency: 0,
      },
      overallScore: 0,
      trend: "new",
      trendDelta: 0,
      sorenessFlag: false,
    };
  }

  const sorted = [...history].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
  const current = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const consistency = computeConsistency(sorted.slice(-4));
  const pillars = computePillars(current.answers, consistency);
  const overallScore = computeOverallScore(pillars);

  let trend: MemberScorecard["trend"] = "new";
  let trendDelta = 0;
  if (previous) {
    const previousPillars = computePillars(
      previous.answers,
      computeConsistency(sorted.slice(0, sorted.length - 1).slice(-4)),
    );
    const previousOverall = computeOverallScore(previousPillars);
    trendDelta = overallScore - previousOverall;
    trend = trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "flat";
  }

  return {
    pillars,
    overallScore,
    trend,
    trendDelta,
    sorenessFlag: current.answers.sorenessFlag,
  };
}
