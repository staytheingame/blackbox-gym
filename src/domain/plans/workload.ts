/**
 * Program günü → antrenman kaydı çevirisi.
 *
 * Sporcu "Tamamla"ya bastığında elle form doldurmuyor; o günün planındaki
 * round/süre/RPE bilgisinden bir `TrainingLog` türetilir. Saf fonksiyon:
 * veritabanına dokunmaz, yalnız hesaplar (bkz. `workload.test.ts`).
 */

export type PlanItemWorkload = {
  kind: string;
  rounds: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  targetRpe: number | null;
};

export type PlanDayWorkload = {
  /** `TrainingLog.type` — şablon türünden gelir. */
  type: "boks" | "kondisyon";
  durationMinutes: number;
  rounds: number;
  /** RPE 1–10. */
  intensity: number;
};

/** Elle loglamadaki sınırlarla aynı (bkz. uye/antrenman/actions.ts). */
const MIN_MINUTES = 5;
const MAX_MINUTES = 300;

/** Planda süre yazmayan gün için makul bir seans uzunluğu. */
const DEFAULT_MINUTES = 45;

/** Hedef RPE yazılmamışsa orta-üstü bir efor varsayılır. */
const DEFAULT_RPE = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function summarizePlanDay(
  items: PlanItemWorkload[],
  templateKind: string,
): PlanDayWorkload {
  let seconds = 0;
  let rounds = 0;
  let rpeTotal = 0;
  let rpeCount = 0;

  for (const item of items) {
    // Round sayısı verilmişse süre/dinlenme round başınadır.
    const repeat = item.rounds && item.rounds > 0 ? item.rounds : 1;
    seconds += ((item.durationSeconds ?? 0) + (item.restSeconds ?? 0)) * repeat;

    if (item.rounds && item.rounds > 0) rounds += item.rounds;

    if (item.targetRpe && item.targetRpe > 0) {
      rpeTotal += item.targetRpe;
      rpeCount += 1;
    }
  }

  const minutes = seconds > 0 ? Math.round(seconds / 60) : DEFAULT_MINUTES;

  return {
    type: templateKind === "kondisyon" ? "kondisyon" : "boks",
    durationMinutes: clamp(minutes, MIN_MINUTES, MAX_MINUTES),
    rounds,
    intensity: clamp(
      rpeCount > 0 ? Math.round(rpeTotal / rpeCount) : DEFAULT_RPE,
      1,
      10,
    ),
  };
}
