/**
 * Rapor dönemleri — günlük / haftalık / aylık.
 *
 * Sınırlar salon saat diliminde hesaplanır (bkz. `src/lib/date.ts`): "bugünün
 * tahsilatı" Istanbul'da gece yarısında biter, UTC'de değil. Aralık her zaman
 * **yarı açıktır**: `start <= t < end` — bir ödeme iki döneme birden düşmez.
 */

import {
  addGymDays,
  addGymMonths,
  formatDayTR,
  formatMonthTR,
  formatShortDateTR,
  getDayStartInstant,
  getMonthStartInstant,
  getWeekStartInstant,
  toGymDateKey,
  toGymMonthKey,
} from "@/lib/date";

export const PERIOD_KINDS = ["gun", "hafta", "ay"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  gun: "Günlük",
  hafta: "Haftalık",
  ay: "Aylık",
};

export type Period = {
  kind: PeriodKind;
  /** Dâhil. */
  start: Date;
  /** Hariç — filtrede `lt` kullan. */
  end: Date;
  /** "2026-08-20" | "2026-W34" | "2026-08" — sıralama ve dedupe anahtarı. */
  key: string;
  /** Ekranda görünen ad: "20 Ağustos Perşembe" | "18–24 Ağustos" | "Ağustos 2026". */
  label: string;
  /** Grafik ekseni için kısa ad. */
  shortLabel: string;
};

export function periodContaining(kind: PeriodKind, at: Date): Period {
  const start =
    kind === "gun"
      ? getDayStartInstant(at)
      : kind === "hafta"
        ? getWeekStartInstant(at)
        : getMonthStartInstant(at);

  return buildPeriod(kind, start);
}

function buildPeriod(kind: PeriodKind, start: Date): Period {
  const end =
    kind === "gun"
      ? addGymDays(start, 1)
      : kind === "hafta"
        ? addGymDays(start, 7)
        : addGymMonths(start, 1);

  return {
    kind,
    start,
    end,
    key: periodKey(kind, start),
    label: periodLabel(kind, start, end),
    shortLabel: periodShortLabel(kind, start),
  };
}

function periodKey(kind: PeriodKind, start: Date): string {
  if (kind === "gun") return toGymDateKey(start);
  if (kind === "ay") return toGymMonthKey(start);
  return `${toGymDateKey(start)}/h`;
}

function periodLabel(kind: PeriodKind, start: Date, end: Date): string {
  if (kind === "gun") return formatDayTR(start);
  if (kind === "ay") return formatMonthTR(start);
  const lastDay = addGymDays(end, -1);
  return `${formatShortDateTR(start)} – ${formatShortDateTR(lastDay)}`;
}

function periodShortLabel(kind: PeriodKind, start: Date): string {
  if (kind === "ay") return formatMonthTR(start).replace(/ \d{4}$/, "");
  return formatShortDateTR(start).slice(0, 5); // "20.08"
}

/** Dönemi ileri/geri kaydırır — `-1` bir önceki dönem. */
export function shiftPeriod(period: Period, delta: number): Period {
  const start =
    period.kind === "gun"
      ? addGymDays(period.start, delta)
      : period.kind === "hafta"
        ? addGymDays(period.start, delta * 7)
        : addGymMonths(period.start, delta);
  return buildPeriod(period.kind, start);
}

/**
 * Son `count` dönem, eskiden yeniye. `count = 1` yalnız içinde bulunulan
 * dönemi verir — trend grafiği bunu ters çevirmeden çizer.
 */
export function recentPeriods(
  kind: PeriodKind,
  count: number,
  now: Date = new Date(),
): Period[] {
  const current = periodContaining(kind, now);
  const periods: Period[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    periods.push(shiftPeriod(current, -index));
  }
  return periods;
}

/** Zaman damgasını dönem anahtarına eşler — kovalama için. */
export function bucketKeyFor(kind: PeriodKind, at: Date): string {
  return periodContaining(kind, at).key;
}

/**
 * Zaman damgalı kayıtları dönemlere böler ve her dönemin toplamını verir.
 * Dönem dışındaki kayıt sessizce atlanır (çağıran zaten aralıkla sorgular).
 */
export function bucketSums<T>(
  entries: readonly T[],
  periods: readonly Period[],
  at: (entry: T) => Date,
  amount: (entry: T) => number,
): number[] {
  const totals = new Map<string, number>();
  for (const period of periods) totals.set(period.key, 0);

  for (const entry of entries) {
    const key = bucketKeyFor(periods[0]?.kind ?? "gun", at(entry));
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + amount(entry));
  }

  return periods.map((period) => totals.get(period.key) ?? 0);
}
