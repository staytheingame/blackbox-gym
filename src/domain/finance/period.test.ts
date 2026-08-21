import { describe, expect, it } from "vitest";
import {
  bucketKeyFor,
  bucketSums,
  periodContaining,
  recentPeriods,
  shiftPeriod,
} from "./period";

// Istanbul UTC+3: 20 Ağustos 2026 Perşembe, yerel saat 00:30.
const EARLY_THURSDAY = new Date("2026-08-19T21:30:00.000Z");

describe("periodContaining", () => {
  it("günü salon saatine göre keser — gece yarısından sonrası yeni gündür", () => {
    const period = periodContaining("gun", EARLY_THURSDAY);
    expect(period.key).toBe("2026-08-20");
    // Istanbul'da 20 Ağustos 00:00 = UTC 19 Ağustos 21:00
    expect(period.start.toISOString()).toBe("2026-08-19T21:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-20T21:00:00.000Z");
  });

  it("hafta Pazartesi başlar", () => {
    const period = periodContaining("hafta", EARLY_THURSDAY);
    expect(period.key).toBe("2026-08-17/h");
    expect(period.start.toISOString()).toBe("2026-08-16T21:00:00.000Z");
  });

  it("ay ayın 1'inde başlar", () => {
    const period = periodContaining("ay", EARLY_THURSDAY);
    expect(period.key).toBe("2026-08");
    expect(period.start.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });

  it("aralık yarı açıktır — bitiş anı bir sonraki döneme aittir", () => {
    const period = periodContaining("gun", EARLY_THURSDAY);
    expect(bucketKeyFor("gun", period.end)).toBe("2026-08-21");
  });
});

describe("shiftPeriod", () => {
  it("bir önceki güne/haftaya/aya gider", () => {
    expect(shiftPeriod(periodContaining("gun", EARLY_THURSDAY), -1).key).toBe(
      "2026-08-19",
    );
    expect(shiftPeriod(periodContaining("hafta", EARLY_THURSDAY), -1).key).toBe(
      "2026-08-10/h",
    );
    expect(shiftPeriod(periodContaining("ay", EARLY_THURSDAY), -1).key).toBe(
      "2026-07",
    );
  });

  it("yıl sınırını aşabilir", () => {
    const january = periodContaining("ay", new Date("2026-01-15T12:00:00.000Z"));
    expect(shiftPeriod(january, -1).key).toBe("2025-12");
  });
});

describe("recentPeriods", () => {
  it("eskiden yeniye sıralar ve sonuncusu içinde bulunulan dönemdir", () => {
    const periods = recentPeriods("ay", 3, EARLY_THURSDAY);
    expect(periods.map((period) => period.key)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("tek dönem istendiğinde yalnız bugünü verir", () => {
    expect(recentPeriods("gun", 1, EARLY_THURSDAY)[0]?.key).toBe("2026-08-20");
  });
});

describe("bucketSums", () => {
  it("kayıtları dönemlere böler, dışarıda kalanı yok sayar", () => {
    const periods = recentPeriods("gun", 3, EARLY_THURSDAY); // 18, 19, 20 Ağustos
    const entries = [
      { at: new Date("2026-08-18T10:00:00.000Z"), amount: 100 },
      { at: new Date("2026-08-20T10:00:00.000Z"), amount: 250 },
      { at: new Date("2026-08-20T14:00:00.000Z"), amount: 50 },
      { at: new Date("2026-01-01T10:00:00.000Z"), amount: 999 },
    ];

    expect(
      bucketSums(entries, periods, (entry) => entry.at, (entry) => entry.amount),
    ).toEqual([100, 0, 300]);
  });
});
