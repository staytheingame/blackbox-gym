import { describe, expect, it } from "vitest";
import { computeMemberScorecard } from "./scorecard";
import type { CheckInRecord } from "./types";

const baseAnswers = {
  plannedSessions: 4,
  completedSessions: 4,
  sleepQuality: 5,
  stressLevel: 1,
  energyLevel: 5,
  enjoyment: 5,
  sorenessFlag: false,
};

describe("computeMemberScorecard", () => {
  it("boş geçmişte sıfır skor ve 'new' trend döner", () => {
    const result = computeMemberScorecard([]);
    expect(result.overallScore).toBe(0);
    expect(result.trend).toBe("new");
  });

  it("mükemmel cevaplarda yüksek genel skor üretir", () => {
    const history: CheckInRecord[] = [
      { weekStart: "2026-01-05", answers: baseAnswers },
    ];
    const result = computeMemberScorecard(history);
    expect(result.overallScore).toBeGreaterThanOrEqual(95);
    expect(result.pillars.training).toBe(100);
    expect(result.pillars.stress).toBe(100); // düşük stres -> yüksek skor
    expect(result.trend).toBe("new");
  });

  it("kötü cevaplarda düşük skor üretir", () => {
    const history: CheckInRecord[] = [
      {
        weekStart: "2026-01-05",
        answers: {
          ...baseAnswers,
          completedSessions: 0,
          sleepQuality: 1,
          stressLevel: 5,
          energyLevel: 1,
          enjoyment: 1,
        },
      },
    ];
    const result = computeMemberScorecard(history);
    expect(result.overallScore).toBeLessThanOrEqual(5);
  });

  it("iyileşme olduğunda trend 'up' olur", () => {
    const history: CheckInRecord[] = [
      {
        weekStart: "2026-01-05",
        answers: { ...baseAnswers, completedSessions: 1, sleepQuality: 2 },
      },
      { weekStart: "2026-01-12", answers: baseAnswers },
    ];
    const result = computeMemberScorecard(history);
    expect(result.trend).toBe("up");
    expect(result.trendDelta).toBeGreaterThan(0);
  });

  it("sorenessFlag son check-in'den yansıtılır", () => {
    const history: CheckInRecord[] = [
      {
        weekStart: "2026-01-05",
        answers: { ...baseAnswers, sorenessFlag: true },
      },
    ];
    const result = computeMemberScorecard(history);
    expect(result.sorenessFlag).toBe(true);
  });

  it("son 4 check-in'e göre tutarlılık (consistency) hesaplar", () => {
    const history: CheckInRecord[] = [
      { weekStart: "2026-01-05", answers: baseAnswers },
      { weekStart: "2026-01-12", answers: baseAnswers },
    ];
    const result = computeMemberScorecard(history);
    expect(result.pillars.consistency).toBe(50); // 2/4 pencere
  });
});
