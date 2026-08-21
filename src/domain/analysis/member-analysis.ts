/**
 * SPORCU ANALİZİ — "bu kişi nasıl gidiyor" sorusunun tek cevabı.
 *
 * Kong Academy'nin koç içgörülerinden alınan DİL KURALI burada da geçerlidir:
 *
 *   1. **Teşhis yok.** "Motivasyonu düşük", "disiplinsiz" gibi kişilik
 *      yorumları üretilmez. Yalnız gözlenen davranış tarif edilir:
 *      "son 4 haftada 3 ders, önceki 4 haftada 8 ders".
 *   2. **Her sayının kaynağı bellidir.** Ekranda hangi kayıttan geldiği
 *      yazılır; sporcu itiraz ederse birlikte bakılabilir.
 *   3. **Veri azsa açıkça söylenir.** İki haftalık kayıtla "gelişim %40
 *      düştü" demek sahte kesinliktir; güven düzeyi `dusuk` işaretlenir ve
 *      ekranda uyarı çıkar.
 *
 * Saf modül: tarih aralıkları ve kayıtlar dışarıdan gelir, veritabanı bilmez.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export type Confidence = "yok" | "dusuk" | "yeterli";

export type Trend = "yukselis" | "sabit" | "dusus" | "belirsiz";

export const TREND_LABEL: Record<Trend, string> = {
  yukselis: "Yükselişte",
  sabit: "Sabit",
  dusus: "Düşüşte",
  belirsiz: "Belirsiz",
};

// ── Girdi kayıtları ───────────────────────────────────────────

export type AttendanceRecord = {
  startsAt: Date;
  /** katildi | gelmedi | onayli | iptal | bekliyor | reddedildi */
  status: string;
};

export type TrainingRecord = {
  loggedAt: Date;
  durationMinutes: number;
  intensity: number;
};

export type CheckInRecord = {
  weekStart: Date;
};

export type WeightRecord = {
  takenAt: Date;
  weightKg: number;
};

export type AnalysisInput = {
  now: Date;
  /** Sporcunun salona kayıt tarihi — "yeni üye" ayrımı için. */
  memberSince: Date;
  attendance: AttendanceRecord[];
  trainings: TrainingRecord[];
  checkIns: CheckInRecord[];
  weights: WeightRecord[];
  /** Plan günlerinden kaçı tamamlandı (atanmış plan yoksa `null`). */
  planCompletion: { completed: number; expected: number } | null;
  /** Beslenme uyum yüzdesi (plan yoksa `null`). */
  nutritionPercent: number | null;
  /**
   * Beslenme yüzdesinin güvenilirliği. Yeni yazılmış planda birkaç günlük
   * veriyle çıkan düşük yüzde bir davranış değil, sadece zaman eksikliğidir —
   * `yeterli` değilse bayrak üretilmez (sayı yine gösterilir).
   */
  nutritionConfidence?: Confidence;
  membership: {
    endDate: Date;
    daysLeft: number;
    sessionsRemaining: number | null;
    unlimited: boolean;
  } | null;
};

// ── Çıktı ─────────────────────────────────────────────────────

export type AttendanceAnalysis = {
  /** Yoklaması alınmış seans sayısı. */
  scheduled: number;
  attended: number;
  missed: number;
  /** Gelme oranı — yoklaması alınmış seanslar içinde. */
  showRate: number;
  confidence: Confidence;
  /** Son 4 hafta ile önceki 4 haftanın ders sayısı. */
  recentCount: number;
  previousCount: number;
  trend: Trend;
  weeklyAverage: number;
  lastAttendedAt: Date | null;
  /** Kaç gündür salona gelmedi. */
  daysSinceLastVisit: number | null;
};

export type VolumeAnalysis = {
  recentMinutes: number;
  previousMinutes: number;
  trend: Trend;
  averageIntensity: number | null;
  sessionsLogged: number;
};

export type CheckInAnalysis = {
  /** Üyeliğinden bu yana geçen (en fazla 8) hafta. */
  expectedWeeks: number;
  submittedWeeks: number;
  percent: number;
  streak: number;
  confidence: Confidence;
};

export type WeightAnalysis = {
  first: number | null;
  last: number | null;
  deltaKg: number | null;
  /** Haftalık ortalama değişim — sıklet planlamasında kritik. */
  weeklyDeltaKg: number | null;
  measurements: number;
  confidence: Confidence;
};

export type PackageAnalysis = {
  daysLeft: number;
  sessionsRemaining: number | null;
  unlimited: boolean;
  /** Haftada kaç ders yakıyor — son 4 haftanın ortalaması. */
  burnPerWeek: number;
  /** Bu hızla ders hakkı kaç hafta sonra biter (`null` = hesaplanamıyor). */
  weeksUntilCreditsOut: number | null;
  /** Hangisi önce biter: süre mi hak mı. */
  bottleneck: "sure" | "hak" | "yok";
  /** Süre dolmadan ders hakkı bitecek mi (paket boşa gidiyor mu). */
  wastesCredits: boolean;
};

export type RiskFlag = {
  key:
    | "gelmiyor"
    | "gelmedi-cok"
    | "kontrol-yok"
    | "hacim-dusus"
    | "paket-bitiyor"
    | "hak-bosa-gidiyor"
    | "plan-uyumsuz"
    | "beslenme-uyumsuz";
  /** Kırmızı mı sarı mı — sıralamada kırmızılar üstte. */
  severity: "yuksek" | "orta";
  label: string;
  /** Sayının nereden geldiği — ekranda küçük punto ile yazılır. */
  evidence: string;
  /** Antrenörün yapacağı iş. */
  action: string;
};

export type MemberAnalysis = {
  attendance: AttendanceAnalysis;
  volume: VolumeAnalysis;
  checkIn: CheckInAnalysis;
  weight: WeightAnalysis;
  package: PackageAnalysis | null;
  planPercent: number | null;
  nutritionPercent: number | null;
  flags: RiskFlag[];
  /** 0–100. Ölçülemeyen boyut ortalamaya girmez. */
  continuityScore: number;
  confidence: Confidence;
  /** Tek cümlelik özet — teşhis değil, gözlem. */
  summary: string;
};

// ── Yardımcılar ───────────────────────────────────────────────

function inWindow(date: Date, from: number, to: number): boolean {
  const time = date.getTime();
  return time >= from && time < to;
}

/**
 * İki dönem karşılaştırması. Eşik %20: altındaki fark gürültüdür, "düştü"
 * demek yanlış olur. İki dönem de boşsa yön yoktur.
 */
export function compareTrend(recent: number, previous: number): Trend {
  if (recent === 0 && previous === 0) return "belirsiz";
  if (previous === 0) return recent > 0 ? "yukselis" : "belirsiz";

  const change = (recent - previous) / previous;
  if (change >= 0.2) return "yukselis";
  if (change <= -0.2) return "dusus";
  return "sabit";
}

function confidenceFromCount(count: number, enough: number): Confidence {
  if (count === 0) return "yok";
  return count >= enough ? "yeterli" : "dusuk";
}

// ── Bölüm hesapları ───────────────────────────────────────────

export function analyzeAttendance(
  input: Pick<AnalysisInput, "attendance" | "now">,
): AttendanceAnalysis {
  const now = input.now.getTime();
  const recentFrom = now - 4 * MS_PER_WEEK;
  const previousFrom = now - 8 * MS_PER_WEEK;

  const settled = input.attendance.filter(
    (row) => row.status === "katildi" || row.status === "gelmedi",
  );
  const attended = settled.filter((row) => row.status === "katildi");
  const missed = settled.length - attended.length;

  const recentCount = attended.filter((row) =>
    inWindow(row.startsAt, recentFrom, now),
  ).length;
  const previousCount = attended.filter((row) =>
    inWindow(row.startsAt, previousFrom, recentFrom),
  ).length;

  const lastAttendedAt =
    attended.length === 0
      ? null
      : attended.reduce((latest, row) =>
          row.startsAt > latest.startsAt ? row : latest,
        ).startsAt;

  return {
    scheduled: settled.length,
    attended: attended.length,
    missed,
    showRate:
      settled.length === 0
        ? 0
        : Math.round((attended.length / settled.length) * 100),
    confidence: confidenceFromCount(settled.length, 4),
    recentCount,
    previousCount,
    trend: compareTrend(recentCount, previousCount),
    weeklyAverage: Math.round((recentCount / 4) * 10) / 10,
    lastAttendedAt,
    daysSinceLastVisit: lastAttendedAt
      ? Math.floor((now - lastAttendedAt.getTime()) / MS_PER_DAY)
      : null,
  };
}

export function analyzeVolume(
  input: Pick<AnalysisInput, "trainings" | "now">,
): VolumeAnalysis {
  const now = input.now.getTime();
  const recentFrom = now - 4 * MS_PER_WEEK;
  const previousFrom = now - 8 * MS_PER_WEEK;

  const sum = (from: number, to: number) =>
    input.trainings
      .filter((row) => inWindow(row.loggedAt, from, to))
      .reduce((total, row) => total + row.durationMinutes, 0);

  const recentMinutes = sum(recentFrom, now);
  const previousMinutes = sum(previousFrom, recentFrom);

  const recent = input.trainings.filter((row) =>
    inWindow(row.loggedAt, recentFrom, now),
  );
  const averageIntensity =
    recent.length === 0
      ? null
      : Math.round(
          (recent.reduce((total, row) => total + row.intensity, 0) /
            recent.length) *
            10,
        ) / 10;

  return {
    recentMinutes,
    previousMinutes,
    trend: compareTrend(recentMinutes, previousMinutes),
    averageIntensity,
    sessionsLogged: recent.length,
  };
}

export function analyzeCheckIns(
  input: Pick<AnalysisInput, "checkIns" | "now" | "memberSince">,
): CheckInAnalysis {
  const weeksAsMember = Math.max(
    1,
    Math.min(
      8,
      Math.ceil(
        (input.now.getTime() - input.memberSince.getTime()) / MS_PER_WEEK,
      ),
    ),
  );

  const since = input.now.getTime() - weeksAsMember * MS_PER_WEEK;
  const recent = input.checkIns.filter(
    (row) => row.weekStart.getTime() >= since,
  );

  // Seri: en yeni haftadan geriye doğru kesintisiz hafta sayısı.
  const sorted = [...input.checkIns].sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );
  let streak = 0;
  let cursor: number | null = null;
  for (const row of sorted) {
    const week = row.weekStart.getTime();
    if (cursor === null || cursor - week === MS_PER_WEEK) {
      streak += 1;
      cursor = week;
    } else if (cursor === week) {
      continue;
    } else {
      break;
    }
  }

  return {
    expectedWeeks: weeksAsMember,
    submittedWeeks: recent.length,
    percent: Math.min(Math.round((recent.length / weeksAsMember) * 100), 100),
    streak,
    confidence: weeksAsMember < 3 ? "dusuk" : "yeterli",
  };
}

export function analyzeWeight(
  input: Pick<AnalysisInput, "weights">,
): WeightAnalysis {
  const sorted = [...input.weights].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
  );

  if (sorted.length === 0) {
    return {
      first: null,
      last: null,
      deltaKg: null,
      weeklyDeltaKg: null,
      measurements: 0,
      confidence: "yok",
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const deltaKg = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const weeks =
    (last.takenAt.getTime() - first.takenAt.getTime()) / MS_PER_WEEK;

  return {
    first: first.weightKg,
    last: last.weightKg,
    deltaKg,
    weeklyDeltaKg: weeks >= 1 ? Math.round((deltaKg / weeks) * 100) / 100 : null,
    measurements: sorted.length,
    confidence: confidenceFromCount(sorted.length, 3),
  };
}

export function analyzePackage(
  input: Pick<AnalysisInput, "membership">,
  weeklyAverage: number,
): PackageAnalysis | null {
  if (!input.membership) return null;

  const { daysLeft, sessionsRemaining, unlimited } = input.membership;
  const burnPerWeek = weeklyAverage;

  const weeksUntilCreditsOut =
    unlimited || sessionsRemaining === null || burnPerWeek <= 0
      ? null
      : Math.round((sessionsRemaining / burnPerWeek) * 10) / 10;

  const weeksLeftByDate = daysLeft / 7;

  let bottleneck: PackageAnalysis["bottleneck"] = "yok";
  if (weeksUntilCreditsOut !== null) {
    bottleneck = weeksUntilCreditsOut <= weeksLeftByDate ? "hak" : "sure";
  } else if (daysLeft <= 14) {
    bottleneck = "sure";
  }

  return {
    daysLeft,
    sessionsRemaining,
    unlimited,
    burnPerWeek,
    weeksUntilCreditsOut,
    bottleneck,
    // Süre dolduğunda ders hakkı artıyorsa sporcu parasının karşılığını
    // alamıyor demektir — yenilemeden önce konuşulacak konu bu.
    wastesCredits:
      !unlimited &&
      sessionsRemaining !== null &&
      sessionsRemaining > 0 &&
      weeksUntilCreditsOut !== null &&
      weeksUntilCreditsOut > weeksLeftByDate,
  };
}

// ── Bayraklar ve özet ─────────────────────────────────────────

function buildFlags(
  attendance: AttendanceAnalysis,
  volume: VolumeAnalysis,
  checkIn: CheckInAnalysis,
  pkg: PackageAnalysis | null,
  planPercent: number | null,
  nutritionPercent: number | null,
  nutritionConfidence: Confidence,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (attendance.daysSinceLastVisit !== null && attendance.daysSinceLastVisit >= 14) {
    flags.push({
      key: "gelmiyor",
      severity: "yuksek",
      label: `${attendance.daysSinceLastVisit} gündür gelmedi`,
      evidence: "Son katıldığı seans kaydı",
      action: "Ara ya da mesaj at — iki hafta sessizlik çoğu bırakmanın başlangıcı.",
    });
  }

  if (attendance.scheduled >= 4 && attendance.showRate < 70) {
    flags.push({
      key: "gelmedi-cok",
      severity: "yuksek",
      label: `Gelme oranı %${attendance.showRate}`,
      evidence: `${attendance.scheduled} yoklamalı seansın ${attendance.missed} tanesinde gelmedi`,
      action: "Saat sporcuya uymuyor olabilir; birlikte yeni bir saat seçin.",
    });
  }

  if (checkIn.confidence === "yeterli" && checkIn.percent < 50) {
    flags.push({
      key: "kontrol-yok",
      severity: "orta",
      label: `Kontrol devamlılığı %${checkIn.percent}`,
      evidence: `${checkIn.expectedWeeks} haftanın ${checkIn.submittedWeeks} tanesinde kontrol gönderdi`,
      action: "Haftalık kontrolü hatırlat — gelişimi görmek için tek düzenli veri bu.",
    });
  }

  if (volume.trend === "dusus" && volume.previousMinutes > 0) {
    flags.push({
      key: "hacim-dusus",
      severity: "orta",
      label: "Antrenman hacmi düşüşte",
      evidence: `Son 4 hafta ${volume.recentMinutes} dk, önceki 4 hafta ${volume.previousMinutes} dk`,
      action: "Sakatlık, iş yoğunluğu ya da program ağırlığı olabilir — sor.",
    });
  }

  if (pkg && (pkg.daysLeft <= 14 || (pkg.sessionsRemaining ?? 99) <= 3)) {
    flags.push({
      key: "paket-bitiyor",
      severity: "yuksek",
      label:
        pkg.sessionsRemaining === null
          ? `${pkg.daysLeft} gün kaldı`
          : `${pkg.daysLeft} gün / ${pkg.sessionsRemaining} ders kaldı`,
      evidence: "Yürürlükteki üyelik kaydı",
      action: "Yenileme konuşmasını şimdi yap; paket bitince rezervasyon kapanır.",
    });
  }

  if (pkg?.wastesCredits) {
    flags.push({
      key: "hak-bosa-gidiyor",
      severity: "orta",
      label: `${pkg.sessionsRemaining} ders kullanılmadan bitebilir`,
      evidence: `Haftada ${pkg.burnPerWeek} ders hızıyla ${pkg.weeksUntilCreditsOut} hafta gerekir, ${Math.round(pkg.daysLeft / 7)} hafta kaldı`,
      action: "Haftalık ders sayısını artırın ya da süre uzatımı konuşun.",
    });
  }

  if (planPercent !== null && planPercent < 50) {
    flags.push({
      key: "plan-uyumsuz",
      severity: "orta",
      label: `Program uyumu %${planPercent}`,
      evidence: "Atanmış plandaki tamamlanan gün sayısı",
      action: "Program fazla ağır olabilir; hafta içi gün sayısını azaltmayı dene.",
    });
  }

  if (
    nutritionPercent !== null &&
    nutritionPercent < 50 &&
    nutritionConfidence === "yeterli"
  ) {
    flags.push({
      key: "beslenme-uyumsuz",
      severity: "orta",
      label: `Beslenme uyumu %${nutritionPercent}`,
      evidence: "İşaretlenen öğün sayısı",
      action: "Öğün sayısını azalt ya da alternatifleri çoğalt — uygulanabilirlik önce gelir.",
    });
  }

  return flags.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "yuksek" ? -1 : 1,
  );
}

/**
 * Devamlılık skoru — ölçülebilen boyutların ortalaması.
 * Ölçülemeyen boyut (ör. beslenme planı yoksa) ortalamayı BOZMAZ, hiç girmez.
 */
function continuityScore(
  attendance: AttendanceAnalysis,
  checkIn: CheckInAnalysis,
  planPercent: number | null,
  nutritionPercent: number | null,
): number {
  const parts: number[] = [];

  if (attendance.scheduled > 0) parts.push(attendance.showRate);
  if (checkIn.expectedWeeks > 0) parts.push(checkIn.percent);
  if (planPercent !== null) parts.push(planPercent);
  if (nutritionPercent !== null) parts.push(nutritionPercent);

  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function buildSummary(
  attendance: AttendanceAnalysis,
  confidence: Confidence,
): string {
  if (confidence === "yok") {
    return "Henüz yorum yapacak kadar kayıt yok — ilk dersler işlendiğinde burası dolar.";
  }
  if (confidence === "dusuk") {
    return `Şu ana kadar ${attendance.attended} ders işlendi. Sağlıklı bir eğilim için birkaç hafta daha veri gerekiyor.`;
  }

  const yon =
    attendance.trend === "dusus"
      ? "azalıyor"
      : attendance.trend === "yukselis"
        ? "artıyor"
        : "sabit";

  return `Son 4 haftada ${attendance.recentCount}, önceki 4 haftada ${attendance.previousCount} ders — devam ${yon}. Gelme oranı %${attendance.showRate}.`;
}

/** Tüm bölümleri hesaplar; ekran bunu doğrudan basar. */
export function analyzeMember(input: AnalysisInput): MemberAnalysis {
  const attendance = analyzeAttendance(input);
  const volume = analyzeVolume(input);
  const checkIn = analyzeCheckIns(input);
  const weight = analyzeWeight(input);
  const pkg = analyzePackage(input, attendance.weeklyAverage);

  const planPercent =
    input.planCompletion && input.planCompletion.expected > 0
      ? Math.min(
          Math.round(
            (input.planCompletion.completed / input.planCompletion.expected) *
              100,
          ),
          100,
        )
      : null;

  const flags = buildFlags(
    attendance,
    volume,
    checkIn,
    pkg,
    planPercent,
    input.nutritionPercent,
    input.nutritionConfidence ?? "yeterli",
  );

  // Genel güven: en zayıf halka belirler. Yoklaması alınmış 4 seans ve
  // 3 haftalık üyelik altında "yeterli" denmez.
  const confidence: Confidence =
    attendance.confidence === "yok" && checkIn.submittedWeeks === 0
      ? "yok"
      : attendance.confidence === "yeterli" && checkIn.confidence === "yeterli"
        ? "yeterli"
        : "dusuk";

  return {
    attendance,
    volume,
    checkIn,
    weight,
    package: pkg,
    planPercent,
    nutritionPercent: input.nutritionPercent,
    flags,
    continuityScore: continuityScore(
      attendance,
      checkIn,
      planPercent,
      // Güvenilir olmayan beslenme yüzdesi ortalamayı aşağı çekmesin.
      input.nutritionConfidence === "dusuk" ? null : input.nutritionPercent,
    ),
    confidence,
    summary: buildSummary(attendance, confidence),
  };
}
