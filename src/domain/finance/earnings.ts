/**
 * Antrenör hakedişi — saf hesap. Veritabanı bilmez, tarih üretmez.
 *
 * Üç kalem bir arada çalışabilir (`karma`); hangisinin işleyeceğini modelin
 * kendisi değil, **dolu olan alanlar** belirler. Böylece "ders başı 250 ₺ +
 * gelir payı %10" gibi karma anlaşmalar tek kayıtta durur.
 *
 * Hakediş doğduğu anda `CoachEarning` satırına **dondurulur**: oran sonradan
 * değişse bile geçmiş ay yeniden hesaplanmaz.
 */

import { applyBps, formatBps, formatMinorTR } from "./money";

export const COMPENSATION_MODELS = [
  "yok",
  "ders_basi",
  "gelir_payi",
  "sabit_maas",
  "karma",
] as const;
export type CompensationModel = (typeof COMPENSATION_MODELS)[number];

export const COMPENSATION_MODEL_LABEL: Record<CompensationModel, string> = {
  yok: "Hakediş yok",
  ders_basi: "Ders başı ücret",
  gelir_payi: "Paket gelirinden pay",
  sabit_maas: "Sabit aylık maaş",
  karma: "Karma (ders başı + pay + maaş)",
};

export type Compensation = {
  model: CompensationModel;
  perSessionMinor: number | null;
  revenueShareBps: number | null;
  monthlySalaryMinor: number | null;
  monthlySessionQuota: number | null;
  currency?: string;
};

/** Hiç ayar girilmemiş antrenör — hakediş üretmez. */
export const NO_COMPENSATION: Compensation = {
  model: "yok",
  perSessionMinor: null,
  revenueShareBps: null,
  monthlySalaryMinor: null,
  monthlySessionQuota: null,
};

function activeFor(
  compensation: Compensation | null | undefined,
  own: CompensationModel,
): boolean {
  if (!compensation) return false;
  return compensation.model === own || compensation.model === "karma";
}

/**
 * Bir seans için antrenöre yazılacak tutar (kuruş).
 *
 * Seans **başına** ödenir, katılan sporcu başına değil: grup dersinde 5 kişi
 * de olsa antrenör bir ders vermiştir. Sporcu başına ödeme isteyen salon
 * `perSessionMinor`'ı kişi başı yazıp çarpanı burada değiştirmelidir.
 */
export function sessionEarningMinor(
  compensation: Compensation | null | undefined,
): number {
  if (!activeFor(compensation, "ders_basi")) return 0;
  return compensation?.perSessionMinor ?? 0;
}

/** Tahsil edilen tutardan antrenöre düşen pay (kuruş). */
export function revenueShareMinor(
  compensation: Compensation | null | undefined,
  paymentAmountMinor: number,
): number {
  if (!activeFor(compensation, "gelir_payi")) return 0;
  const bps = compensation?.revenueShareBps ?? 0;
  if (bps <= 0 || paymentAmountMinor <= 0) return 0;
  return applyBps(paymentAmountMinor, bps);
}

/** Ay kapanışında tahakkuk edecek sabit maaş (kuruş). */
export function salaryAccrualMinor(
  compensation: Compensation | null | undefined,
): number {
  if (!activeFor(compensation, "sabit_maas")) return 0;
  return compensation?.monthlySalaryMinor ?? 0;
}

/**
 * Sözleşmedeki aylık ders hakkından kalan. `null` = sınırsız.
 * Aşım negatif değil, 0 döner — "kalan" hiçbir zaman eksiye düşmez;
 * aşım bilgisi için `quotaOverage` kullanılır.
 */
export function remainingSessionQuota(
  compensation: Compensation | null | undefined,
  sessionsGiven: number,
): number | null {
  const quota = compensation?.monthlySessionQuota ?? null;
  if (quota == null) return null;
  return Math.max(0, quota - sessionsGiven);
}

/** Hakkın üzerine verilen ders sayısı (yoksa 0). */
export function quotaOverage(
  compensation: Compensation | null | undefined,
  sessionsGiven: number,
): number {
  const quota = compensation?.monthlySessionQuota ?? null;
  if (quota == null) return 0;
  return Math.max(0, sessionsGiven - quota);
}

/** Ayarı tek satırda anlatır: "Ders başı 250 ₺ · Gelir payı %40". */
export function describeCompensation(
  compensation: Compensation | null | undefined,
): string {
  if (!compensation || compensation.model === "yok") return "Hakediş yok";
  const currency = compensation.currency ?? "TRY";
  const parts: string[] = [];

  if (activeFor(compensation, "ders_basi") && compensation.perSessionMinor) {
    parts.push(
      `Ders başı ${formatMinorTR(compensation.perSessionMinor, currency)}`,
    );
  }
  if (activeFor(compensation, "gelir_payi") && compensation.revenueShareBps) {
    parts.push(`Gelir payı ${formatBps(compensation.revenueShareBps)}`);
  }
  if (activeFor(compensation, "sabit_maas") && compensation.monthlySalaryMinor) {
    parts.push(
      `Aylık ${formatMinorTR(compensation.monthlySalaryMinor, currency)}`,
    );
  }

  if (parts.length === 0) return "Tutar girilmemiş";
  return parts.join(" · ");
}

/** Ayarın işleyebilmesi için gereken alan dolu mu? Form doğrulaması için. */
export function validateCompensation(
  compensation: Compensation,
): { ok: true } | { ok: false; error: string } {
  const { model } = compensation;
  if (model === "yok") return { ok: true };

  if (
    activeFor(compensation, "ders_basi") &&
    model !== "karma" &&
    !compensation.perSessionMinor
  ) {
    return { ok: false, error: "Ders başı ücret girilmeli." };
  }
  if (
    activeFor(compensation, "gelir_payi") &&
    model !== "karma" &&
    !compensation.revenueShareBps
  ) {
    return { ok: false, error: "Gelir payı yüzdesi girilmeli." };
  }
  if (
    activeFor(compensation, "sabit_maas") &&
    model !== "karma" &&
    !compensation.monthlySalaryMinor
  ) {
    return { ok: false, error: "Aylık maaş tutarı girilmeli." };
  }
  if (
    model === "karma" &&
    !compensation.perSessionMinor &&
    !compensation.revenueShareBps &&
    !compensation.monthlySalaryMinor
  ) {
    return { ok: false, error: "Karma modelde en az bir kalem dolu olmalı." };
  }
  return { ok: true };
}

/** Hakedişin kaynağı — `CoachEarning.sourceType` ile birebir. */
export const EARNING_SOURCES = ["ders", "gelir_payi", "maas"] as const;
export type EarningSource = (typeof EARNING_SOURCES)[number];

export const EARNING_SOURCE_LABEL: Record<EarningSource, string> = {
  ders: "Ders",
  gelir_payi: "Gelir payı",
  maas: "Maaş",
};
