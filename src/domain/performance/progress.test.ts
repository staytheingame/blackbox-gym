import { describe, expect, it } from "vitest";
import {
  scoreTrend,
  summarizeAttendance,
  summarizeProgress,
  weeklyVolume,
} from "./progress";

// 2026-08-18 Salı → haftanın Pazartesi'si 2026-08-17
const TODAY = new Date("2026-08-18T09:00:00.000Z");

describe("summarizeAttendance", () => {
  it("katılım oranını yoklaması alınmış dersler üzerinden hesaplar", () => {
    const summary = summarizeAttendance([
      { status: "katildi", startsAt: TODAY },
      { status: "katildi", startsAt: TODAY },
      { status: "katildi", startsAt: TODAY },
      { status: "gelmedi", startsAt: TODAY },
    ]);

    expect(summary.attended).toBe(3);
    expect(summary.missed).toBe(1);
    expect(summary.ratePercent).toBe(75);
  });

  it("ileri tarihli rezervasyonu orana katmaz", () => {
    const summary = summarizeAttendance([
      { status: "katildi", startsAt: TODAY },
      { status: "onayli", startsAt: TODAY },
      { status: "bekliyor", startsAt: TODAY },
    ]);

    expect(summary.upcoming).toBe(2);
    expect(summary.ratePercent).toBe(100);
  });

  it("iptal edilen kayıt oranı bozmaz", () => {
    const summary = summarizeAttendance([
      { status: "katildi", startsAt: TODAY },
      { status: "iptal", startsAt: TODAY },
    ]);

    expect(summary.ratePercent).toBe(100);
  });

  it("hiç yoklama yoksa oran üretmez (0% demek yanıltıcı olurdu)", () => {
    expect(summarizeAttendance([]).ratePercent).toBeNull();
    expect(
      summarizeAttendance([{ status: "onayli", startsAt: TODAY }]).ratePercent,
    ).toBeNull();
  });
});

describe("weeklyVolume", () => {
  it("istenen hafta sayısı kadar kova üretir, boş haftaları sıfırlar", () => {
    const rows = weeklyVolume([], { weeks: 4, today: TODAY });

    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.weekStart)).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
    expect(rows.every((r) => r.minutes === 0)).toBe(true);
  });

  it("kayıtları ait olduğu haftaya toplar", () => {
    const rows = weeklyVolume(
      [
        { loggedAt: new Date("2026-08-18T10:00:00.000Z"), durationMinutes: 60 },
        { loggedAt: new Date("2026-08-19T10:00:00.000Z"), durationMinutes: 45 },
        { loggedAt: new Date("2026-08-12T10:00:00.000Z"), durationMinutes: 30 },
      ],
      { weeks: 4, today: TODAY },
    );

    const current = rows.find((r) => r.weekStart === "2026-08-17");
    const previous = rows.find((r) => r.weekStart === "2026-08-10");

    expect(current).toEqual({ weekStart: "2026-08-17", minutes: 105, sessions: 2 });
    expect(previous).toEqual({ weekStart: "2026-08-10", minutes: 30, sessions: 1 });
  });

  it("pencerenin dışındaki eski kaydı saymaz", () => {
    const rows = weeklyVolume(
      [{ loggedAt: new Date("2026-01-05T10:00:00.000Z"), durationMinutes: 90 }],
      { weeks: 4, today: TODAY },
    );

    expect(rows.reduce((sum, r) => sum + r.minutes, 0)).toBe(0);
  });
});

describe("scoreTrend", () => {
  it("ilk ve son skor arasındaki farkı verir", () => {
    const trend = scoreTrend([
      { computedAt: new Date("2026-07-01T00:00:00.000Z"), overallScore: 55 },
      { computedAt: new Date("2026-08-01T00:00:00.000Z"), overallScore: 72 },
    ]);

    expect(trend?.first).toBe(55);
    expect(trend?.last).toBe(72);
    expect(trend?.delta).toBe(17);
  });

  it("sırası karışık gelen kayıtları tarihe göre düzeltir", () => {
    const trend = scoreTrend([
      { computedAt: new Date("2026-08-01T00:00:00.000Z"), overallScore: 72 },
      { computedAt: new Date("2026-07-01T00:00:00.000Z"), overallScore: 55 },
    ]);

    expect(trend?.delta).toBe(17);
    expect(trend?.best).toBe(72);
  });

  it("tek kayıtta yalancı ivme üretmez", () => {
    const trend = scoreTrend([
      { computedAt: new Date("2026-08-01T00:00:00.000Z"), overallScore: 61 },
    ]);

    expect(trend?.delta).toBe(0);
  });

  it("kayıt yoksa null döner", () => {
    expect(scoreTrend([])).toBeNull();
  });
});

describe("summarizeProgress", () => {
  it("son 4 haftayı önceki 4 haftayla kıyaslar", () => {
    const progress = summarizeProgress({
      bookings: [{ status: "katildi", startsAt: TODAY }],
      trainingLogs: [
        // önceki 4 hafta: toplam 100 dk
        { loggedAt: new Date("2026-07-01T10:00:00.000Z"), durationMinutes: 100 },
        // son 4 hafta: toplam 150 dk
        { loggedAt: new Date("2026-08-18T10:00:00.000Z"), durationMinutes: 150 },
      ],
      snapshots: [],
      today: TODAY,
    });

    expect(progress.volumeChangePercent).toBe(50);
    expect(progress.averageWeeklyMinutes).toBe(38); // 150 / 4 → 37.5 → 38
  });

  it("önceki dönem boşsa yüzde değişim üretmez (sıfıra bölme yok)", () => {
    const progress = summarizeProgress({
      bookings: [],
      trainingLogs: [
        { loggedAt: new Date("2026-08-18T10:00:00.000Z"), durationMinutes: 60 },
      ],
      snapshots: [],
      today: TODAY,
    });

    expect(progress.volumeChangePercent).toBeNull();
  });

  it("8 haftalık pencere döndürür", () => {
    const progress = summarizeProgress({
      bookings: [],
      trainingLogs: [],
      snapshots: [],
      today: TODAY,
    });

    expect(progress.volume).toHaveLength(8);
  });
});
