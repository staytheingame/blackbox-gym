import { describe, expect, it } from "vitest";
import { gymDateTimeToInstant } from "@/lib/date";
import {
  DEFAULT_REMINDER_CONFIG,
  dueReminders,
  eveningReminderAt,
  packageWarning,
  previousDateKey,
  sameDayReminderAt,
} from "./schedule";

const slotAt = (dateKey: string, time: string) =>
  gymDateTimeToInstant(dateKey, time);

describe("previousDateKey", () => {
  it("ay başında bir önceki aya geçer", () => {
    expect(previousDateKey("2026-09-01")).toBe("2026-08-31");
  });

  it("yıl başında bir önceki yıla geçer", () => {
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
  });
});

describe("hatırlatma anları", () => {
  it("akşam hatırlatması bir önceki gün 20:00 (salon saati)", () => {
    const slot = slotAt("2026-08-20", "19:00");
    expect(eveningReminderAt(slot).toISOString()).toBe(
      slotAt("2026-08-19", "20:00").toISOString(),
    );
  });

  it("gün içi hatırlatması dersin günü 09:00", () => {
    const slot = slotAt("2026-08-20", "19:00");
    expect(sameDayReminderAt(slot).toISOString()).toBe(
      slotAt("2026-08-20", "09:00").toISOString(),
    );
  });
});

describe("dueReminders", () => {
  const slots = [{ bookingId: "b1", startsAt: slotAt("2026-08-20", "19:00") }];

  it("akşam saatinden önce hiçbir şey üretmez", () => {
    const now = slotAt("2026-08-19", "18:00");
    expect(dueReminders({ slots, now })).toEqual([]);
  });

  it("önceki gün 20:00'den sonra akşam hatırlatması üretir", () => {
    const now = slotAt("2026-08-19", "20:05");
    const due = dueReminders({ slots, now });
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ bookingId: "b1", stage: "aksam" });
  });

  it("ders günü sabahtan sonra iki hatırlatma da düşer", () => {
    const now = slotAt("2026-08-20", "09:30");
    const stages = dueReminders({ slots, now }).map((r) => r.stage);
    expect(stages).toEqual(["aksam", "gun"]);
  });

  it("seans başladıysa hiçbir hatırlatma üretmez", () => {
    const now = slotAt("2026-08-20", "19:00");
    expect(dueReminders({ slots, now })).toEqual([]);
  });

  it("sabaha çok yakın seans için gün içi hatırlatması üretmez", () => {
    const erken = [{ bookingId: "b2", startsAt: slotAt("2026-08-20", "09:30") }];
    const now = slotAt("2026-08-20", "09:10");
    const stages = dueReminders({ slots: erken, now }).map((r) => r.stage);
    expect(stages).toEqual(["aksam"]);
  });

  it("kaçırılan çalışma sonrası geç de olsa gönderir, planlanan anı korur", () => {
    const now = slotAt("2026-08-20", "12:00");
    const due = dueReminders({ slots, now });
    expect(due.map((r) => r.scheduledFor.toISOString())).toEqual([
      slotAt("2026-08-19", "20:00").toISOString(),
      slotAt("2026-08-20", "09:00").toISOString(),
    ]);
  });

  it("yapılandırma saatleri değiştirilebilir", () => {
    const config = { ...DEFAULT_REMINDER_CONFIG, eveningHour: 21 };
    const now = slotAt("2026-08-19", "20:30");
    expect(dueReminders({ slots, now, config })).toEqual([]);
  });
});

describe("packageWarning", () => {
  it("süresi geçmiş paket bitti sayılır", () => {
    expect(packageWarning({ daysLeft: -1, sessionsRemaining: 5 })).toBe("bitti");
  });

  it("ders hakkı tükendiyse bitti", () => {
    expect(packageWarning({ daysLeft: 30, sessionsRemaining: 0 })).toBe("bitti");
  });

  it("iki hafta kalınca uyarır", () => {
    expect(packageWarning({ daysLeft: 10, sessionsRemaining: 20 })).toBe(
      "bitiyor",
    );
  });

  it("son üç derste uyarır", () => {
    expect(packageWarning({ daysLeft: 60, sessionsRemaining: 3 })).toBe(
      "bitiyor",
    );
  });

  it("sınırsız pakette yalnız süreye bakar", () => {
    expect(packageWarning({ daysLeft: 60, sessionsRemaining: null })).toBe("yok");
  });
});
