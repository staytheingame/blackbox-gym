export type CheckInAnswers = {
  plannedSessions: number;
  completedSessions: number;
  /** 1 (kötü) – 5 (çok iyi) */
  sleepQuality: number;
  /** 1 (düşük) – 5 (yüksek stres) */
  stressLevel: number;
  /** 1 (düşük) – 5 (yüksek enerji) */
  energyLevel: number;
  /** 1 (keyifsiz) – 5 (çok keyifli) */
  enjoyment: number;
  sorenessFlag: boolean;
  note?: string;
};

export type CheckInRecord = {
  weekStart: string; // ISO date (haftanın başlangıcı)
  answers: CheckInAnswers;
};

export type ScorePillars = {
  training: number;
  sleep: number;
  stress: number;
  energy: number;
  enjoyment: number;
  consistency: number;
};

export type MemberScorecard = {
  pillars: ScorePillars;
  overallScore: number;
  trend: "up" | "down" | "flat" | "new";
  trendDelta: number;
  sorenessFlag: boolean;
};
