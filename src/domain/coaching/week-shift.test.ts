import { describe, expect, it } from "vitest";
import { getWeekStartInstant, gymDateTimeToInstant } from "@/lib/date";
import { buildWeekShift, type ShiftSlotInput } from "./week-shift";

// 2026-09-28 Pazartesi (salon saati Europe/Istanbul, UTC+3).
const WEEK_START = getWeekStartInstant(gymDateTimeToInstant("2026-09-30", "12:00"));
const NOW = gymDateTimeToInstant("2026-09-30", "09:00"); // Çarşamba

function slot(
  day: string,
  time: string,
  overrides: Partial<ShiftSlotInput> = {},
): ShiftSlotInput {
  return {
    startsAt: gymDateTimeToInstant(day, time),
    durationMinutes: 60,
    status: "acik",
    takenSeats: 0,
    capacity: 1,
    ...overrides,
  };
}

describe("buildWeekShift", () => {
  it("her zaman Pazartesi'den başlayan yedi gün döner", () => {
    const days = buildWeekShift([], WEEK_START, NOW);

    expect(days).toHaveLength(7);
    expect(days[0].dateKey).toBe("2026-09-28");
    expect(days[6].dateKey).toBe("2026-10-04");
  });

  it("seansı olmayan günü boş aralıkla gösterir", () => {
    const days = buildWeekShift([], WEEK_START, NOW);

    expect(days.every((day) => day.ranges.length === 0 && day.slotCount === 0)).toBe(true);
  });

  it("bugünü işaretler", () => {
    const days = buildWeekShift([], WEEK_START, NOW);

    expect(days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual([
      "2026-09-30",
    ]);
  });

  it("bitişik seansları tek çalışma aralığında birleştirir", () => {
    const days = buildWeekShift(
      [
        slot("2026-09-28", "10:00"),
        slot("2026-09-28", "11:00"),
        slot("2026-09-28", "12:00"),
      ],
      WEEK_START,
      NOW,
    );

    expect(days[0].ranges).toEqual([
      { start: "10:00", end: "13:00", slotCount: 3, takenSeats: 0, capacity: 3 },
    ]);
  });

  it("aralarında boşluk olan seansları ayrı aralık yapar (öğle arası)", () => {
    const days = buildWeekShift(
      [slot("2026-09-29", "10:00"), slot("2026-09-29", "11:00"), slot("2026-09-29", "17:00")],
      WEEK_START,
      NOW,
    );

    expect(days[1].ranges.map((range) => `${range.start}-${range.end}`)).toEqual([
      "10:00-12:00",
      "17:00-18:00",
    ]);
  });

  it("sıradan bağımsız çalışır: ters gelen seanslar da doğru birleşir", () => {
    const days = buildWeekShift(
      [slot("2026-09-28", "12:00"), slot("2026-09-28", "10:00"), slot("2026-09-28", "11:00")],
      WEEK_START,
      NOW,
    );

    expect(days[0].ranges).toHaveLength(1);
    expect(days[0].ranges[0].start).toBe("10:00");
    expect(days[0].ranges[0].end).toBe("13:00");
  });

  it("iptal edilmiş seansı shift'e katmaz", () => {
    const days = buildWeekShift(
      [slot("2026-09-28", "10:00"), slot("2026-09-28", "11:00", { status: "iptal" })],
      WEEK_START,
      NOW,
    );

    expect(days[0].slotCount).toBe(1);
    expect(days[0].ranges[0].end).toBe("11:00");
  });

  it("doluluk ve kontenjanı aralık başına toplar", () => {
    const days = buildWeekShift(
      [
        slot("2026-10-01", "19:00", { takenSeats: 1, capacity: 1 }),
        slot("2026-10-01", "20:00", { takenSeats: 2, capacity: 3 }),
      ],
      WEEK_START,
      NOW,
    );

    expect(days[3].ranges[0]).toMatchObject({ takenSeats: 3, capacity: 4, slotCount: 2 });
  });

  it("buçuk başlayan ve 90 dakikalık seansta bitişi doğru hesaplar", () => {
    const days = buildWeekShift(
      [slot("2026-10-02", "18:30", { durationMinutes: 90 })],
      WEEK_START,
      NOW,
    );

    expect(days[4].ranges[0]).toMatchObject({ start: "18:30", end: "20:00" });
  });

  it("gece yarısına yakın seansı doğru güne koyar (salon saati, UTC değil)", () => {
    // 23:30 İstanbul = 20:30 UTC aynı gün; 00:30 İstanbul = 21:30 UTC bir önceki gün.
    const days = buildWeekShift(
      [slot("2026-09-28", "23:30"), slot("2026-09-29", "00:30")],
      WEEK_START,
      NOW,
    );

    expect(days[0].slotCount).toBe(1);
    expect(days[1].slotCount).toBe(1);
  });
});
