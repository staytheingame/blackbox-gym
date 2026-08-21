/**
 * Sıklet düşüşü hesapları — saf fonksiyon, veritabanı bilmez.
 *
 * Güvenlik kuralı: haftalık kayıp vücut ağırlığının **%1'ini** geçmemeli.
 * Dövüş sporlarında hızlı su atma yaygın ama sağlıksız; panel bunu
 * "riskli" olarak işaretler, kararı antrenöre bırakır.
 */

export type CutInput = {
  currentKg: number;
  targetKg: number;
  /** Maç/tartı tarihi — yoksa süre bilinmez, yalnız fark hesaplanır. */
  fightDate?: Date | null;
  today: Date;
};

export type CutStatus = "hedefte" | "guvenli" | "riskli" | "imkansiz" | "tarih-yok";

export type CutPlan = {
  /** Hedefe kalan kilo (pozitif = düşecek, negatif = alacak). */
  deltaKg: number;
  daysLeft: number | null;
  weeksLeft: number | null;
  /** Hedefe yetişmek için gereken haftalık kayıp. */
  requiredWeeklyKg: number | null;
  /** Vücut ağırlığının %1'i — güvenli haftalık üst sınır. */
  safeWeeklyKg: number;
  status: CutStatus;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / MS_PER_DAY);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeCutPlan(input: CutInput): CutPlan {
  const deltaKg = round(input.currentKg - input.targetKg);
  const safeWeeklyKg = round(input.currentKg * 0.01);

  // Hedefte ya da altındaysa süre hesabına gerek yok.
  if (deltaKg <= 0) {
    return {
      deltaKg,
      daysLeft: input.fightDate ? daysBetween(input.today, input.fightDate) : null,
      weeksLeft: null,
      requiredWeeklyKg: null,
      safeWeeklyKg,
      status: "hedefte",
    };
  }

  if (!input.fightDate) {
    return {
      deltaKg,
      daysLeft: null,
      weeksLeft: null,
      requiredWeeklyKg: null,
      safeWeeklyKg,
      status: "tarih-yok",
    };
  }

  const daysLeft = daysBetween(input.today, input.fightDate);

  // Tarih geçmişse ya da bugünse hedefe yetişecek süre yok.
  if (daysLeft <= 0) {
    return {
      deltaKg,
      daysLeft,
      weeksLeft: 0,
      requiredWeeklyKg: null,
      safeWeeklyKg,
      status: "imkansiz",
    };
  }

  const weeksLeft = round(daysLeft / 7);
  const requiredWeeklyKg = round(deltaKg / (daysLeft / 7));

  // %50'den fazla aşım artık "riskli" değil, uygulanabilir değil.
  const status: CutStatus =
    requiredWeeklyKg <= safeWeeklyKg
      ? "guvenli"
      : requiredWeeklyKg <= safeWeeklyKg * 1.5
        ? "riskli"
        : "imkansiz";

  return {
    deltaKg,
    daysLeft,
    weeksLeft,
    requiredWeeklyKg,
    safeWeeklyKg,
    status,
  };
}

export const CUT_STATUS_LABEL: Record<CutStatus, string> = {
  hedefte: "Hedefte",
  guvenli: "Güvenli tempo",
  riskli: "Riskli tempo",
  imkansiz: "Sürede yetişmez",
  "tarih-yok": "Tarih girilmedi",
};

/** Ardışık tartı kayıtlarından haftalık ortalama değişim (kg/hafta). */
export function weeklyTrendKg(
  entries: { takenAt: Date; weightKg: number }[],
): number | null {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (last.takenAt.getTime() - first.takenAt.getTime()) / MS_PER_DAY;
  if (days <= 0) return null;

  return round(((last.weightKg - first.weightKg) / days) * 7);
}
