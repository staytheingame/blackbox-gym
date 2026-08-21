import { describe, expect, it } from "vitest";
import { computeCutPlan, weeklyTrendKg } from "./cut";

const today = new Date("2026-08-17T00:00:00.000Z");

describe("computeCutPlan", () => {
  it("hedefin altındaysa 'hedefte' der, süre hesaplamaz", () => {
    const plan = computeCutPlan({
      currentKg: 68,
      targetKg: 69,
      fightDate: new Date("2026-09-19T00:00:00.000Z"),
      today,
    });

    expect(plan.status).toBe("hedefte");
    expect(plan.deltaKg).toBeLessThanOrEqual(0);
    expect(plan.requiredWeeklyKg).toBeNull();
  });

  it("maç tarihi yoksa yalnız farkı verir", () => {
    const plan = computeCutPlan({ currentKg: 75, targetKg: 69, today });

    expect(plan.status).toBe("tarih-yok");
    expect(plan.deltaKg).toBe(6);
    expect(plan.weeksLeft).toBeNull();
  });

  it("haftalık gereken kayıp %1 sınırının altındaysa güvenli", () => {
    // 75 kg → 72 kg, 8 hafta: 0.375 kg/hafta; güvenli sınır 0.75.
    const plan = computeCutPlan({
      currentKg: 75,
      targetKg: 72,
      fightDate: new Date("2026-10-12T00:00:00.000Z"),
      today,
    });

    expect(plan.status).toBe("guvenli");
    expect(plan.safeWeeklyKg).toBe(0.75);
    expect(plan.requiredWeeklyKg).toBeLessThan(plan.safeWeeklyKg);
  });

  it("sınırı biraz aşan tempo riskli sayılır", () => {
    // 75 kg → 72 kg, 3 hafta: 1 kg/hafta; sınır 0.75, 1.5x = 1.125.
    const plan = computeCutPlan({
      currentKg: 75,
      targetKg: 72,
      fightDate: new Date("2026-09-07T00:00:00.000Z"),
      today,
    });

    expect(plan.status).toBe("riskli");
  });

  it("sınırı çok aşan tempo imkansız sayılır", () => {
    // 75 kg → 69 kg, 1 hafta: 6 kg/hafta.
    const plan = computeCutPlan({
      currentKg: 75,
      targetKg: 69,
      fightDate: new Date("2026-08-24T00:00:00.000Z"),
      today,
    });

    expect(plan.status).toBe("imkansiz");
  });

  it("tarih geçmişse yetişmez", () => {
    const plan = computeCutPlan({
      currentKg: 75,
      targetKg: 72,
      fightDate: new Date("2026-08-10T00:00:00.000Z"),
      today,
    });

    expect(plan.status).toBe("imkansiz");
    expect(plan.daysLeft).toBeLessThan(0);
  });
});

describe("weeklyTrendKg", () => {
  it("tek kayıt varsa trend yok", () => {
    expect(
      weeklyTrendKg([{ takenAt: today, weightKg: 75 }]),
    ).toBeNull();
  });

  it("iki hafta arayla 1 kg düşüş → -0.5 kg/hafta", () => {
    const trend = weeklyTrendKg([
      { takenAt: new Date("2026-08-03T00:00:00.000Z"), weightKg: 75 },
      { takenAt: new Date("2026-08-17T00:00:00.000Z"), weightKg: 74 },
    ]);

    expect(trend).toBe(-0.5);
  });

  it("sıralama karışık gelse de doğru hesaplar", () => {
    const trend = weeklyTrendKg([
      { takenAt: new Date("2026-08-17T00:00:00.000Z"), weightKg: 74 },
      { takenAt: new Date("2026-08-10T00:00:00.000Z"), weightKg: 75 },
    ]);

    expect(trend).toBe(-1);
  });
});
