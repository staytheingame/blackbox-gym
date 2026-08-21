/**
 * Gelişim takibi — "sporcu ilerliyor mu?" sorusunun sayısal karşılığı.
 *
 * Saf fonksiyon: kayıtları alır, özet üretir. Veritabanı bilmez.
 * Üç eksen var ve bilinçli olarak ayrı tutulur:
 *   - **Devamlılık** (katılım oranı): söz verdiği derse geliyor mu?
 *   - **Hacim** (haftalık dakika): ne kadar çalışıyor?
 *   - **Skor** (check-in kartı): kendini nasıl hissediyor / nasıl toparlıyor?
 * Biri iyi diğeri kötü olabilir; tek bir "genel puan"a ezmiyoruz.
 */
import { getWeekStart } from "@/lib/date";

export type AttendanceRecord = {
  status: string;
  startsAt: Date;
};

export type AttendanceSummary = {
  attended: number;
  missed: number;
  upcoming: number;
  /** Katılım oranı %; yoklaması alınmış ders yoksa `null`. */
  ratePercent: number | null;
};

export function summarizeAttendance(
  records: AttendanceRecord[],
): AttendanceSummary {
  const attended = records.filter((r) => r.status === "katildi").length;
  const missed = records.filter((r) => r.status === "gelmedi").length;
  const upcoming = records.filter(
    (r) => r.status === "onayli" || r.status === "bekliyor",
  ).length;
  const decided = attended + missed;

  return {
    attended,
    missed,
    upcoming,
    ratePercent: decided === 0 ? null : Math.round((attended / decided) * 100),
  };
}

export type VolumeEntry = {
  loggedAt: Date;
  durationMinutes: number;
};

export type WeeklyVolume = {
  /** Haftanın Pazartesi'si, `YYYY-MM-DD`. */
  weekStart: string;
  minutes: number;
  sessions: number;
};

/**
 * Son `weeks` haftanın antrenman hacmi — kayıt olmayan haftalar 0 olarak
 * doldurulur (grafikte boşluk kalmasın, "o hafta hiç gelmedi" görünsün).
 */
export function weeklyVolume(
  entries: VolumeEntry[],
  { weeks = 8, today = new Date() }: { weeks?: number; today?: Date } = {},
): WeeklyVolume[] {
  const buckets = new Map<string, WeeklyVolume>();
  const thisWeek = getWeekStart(today);

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const key = start.toISOString().slice(0, 10);
    buckets.set(key, { weekStart: key, minutes: 0, sessions: 0 });
  }

  for (const entry of entries) {
    const key = getWeekStart(entry.loggedAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue; // pencerenin dışında
    bucket.minutes += entry.durationMinutes;
    bucket.sessions += 1;
  }

  return [...buckets.values()];
}

export type ScorePoint = {
  computedAt: Date;
  overallScore: number;
};

export type ScoreTrend = {
  first: number;
  last: number;
  /** Son − ilk. Pozitif = gelişme. */
  delta: number;
  best: number;
  points: { date: string; score: number }[];
};

/** Skor geçmişi; tek kayıt varsa delta 0 olur (kıyas yok, yalancı ivme yok). */
export function scoreTrend(points: ScorePoint[]): ScoreTrend | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort(
    (a, b) => a.computedAt.getTime() - b.computedAt.getTime(),
  );
  const first = sorted[0].overallScore;
  const last = sorted[sorted.length - 1].overallScore;

  return {
    first,
    last,
    delta: last - first,
    best: Math.max(...sorted.map((p) => p.overallScore)),
    points: sorted.map((p) => ({
      date: p.computedAt.toISOString().slice(0, 10),
      score: p.overallScore,
    })),
  };
}

export type ProgressSummary = {
  attendance: AttendanceSummary;
  volume: WeeklyVolume[];
  /** Son 4 haftanın haftalık ortalama dakikası. */
  averageWeeklyMinutes: number;
  /** Son 4 hafta ile önceki 4 haftanın hacim farkı, % olarak. */
  volumeChangePercent: number | null;
  score: ScoreTrend | null;
};

export function summarizeProgress(input: {
  bookings: AttendanceRecord[];
  trainingLogs: VolumeEntry[];
  snapshots: ScorePoint[];
  today?: Date;
}): ProgressSummary {
  const volume = weeklyVolume(input.trainingLogs, {
    weeks: 8,
    today: input.today ?? new Date(),
  });

  const recent = volume.slice(-4);
  const previous = volume.slice(0, 4);
  const sum = (rows: WeeklyVolume[]) =>
    rows.reduce((total, row) => total + row.minutes, 0);

  const recentTotal = sum(recent);
  const previousTotal = sum(previous);

  return {
    attendance: summarizeAttendance(input.bookings),
    volume,
    averageWeeklyMinutes:
      recent.length === 0 ? 0 : Math.round(recentTotal / recent.length),
    volumeChangePercent:
      previousTotal === 0
        ? null
        : Math.round(((recentTotal - previousTotal) / previousTotal) * 100),
    score: scoreTrend(input.snapshots),
  };
}
