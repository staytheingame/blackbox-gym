import { describe, expect, it } from "vitest";
import {
  getWeekStart,
  getWeekStartInstant,
  toGymDateKey,
  formatDateTR,
  formatTimeTR,
  gymDayOfWeek,
  gymDateTimeToInstant,
} from "./date";

const iso = (date: Date) => date.toISOString();

describe("getWeekStart", () => {
  it("hafta ortasını o haftanın Pazartesi'sine indirger", () => {
    // 2026-08-19 Çarşamba
    expect(iso(getWeekStart(new Date("2026-08-19T09:00:00.000Z")))).toBe(
      "2026-08-17T00:00:00.000Z",
    );
  });

  it("Pazar'ı bir önceki Pazartesi'ye bağlar (haftanın son günü)", () => {
    // 2026-08-23 Pazar, Istanbul'da öğlen
    expect(iso(getWeekStart(new Date("2026-08-23T09:00:00.000Z")))).toBe(
      "2026-08-17T00:00:00.000Z",
    );
  });

  it("Pazartesi 01:00 Istanbul'u YENİ haftaya sayar (UTC'de hâlâ Pazar)", () => {
    // 2026-08-23T22:00Z = 2026-08-24 Pazartesi 01:00 Istanbul
    expect(iso(getWeekStart(new Date("2026-08-23T22:00:00.000Z")))).toBe(
      "2026-08-24T00:00:00.000Z",
    );
  });

  it("Pazartesi 02:00 UTC (= 05:00 Istanbul) aynı haftada kalır", () => {
    expect(iso(getWeekStart(new Date("2026-08-24T02:00:00.000Z")))).toBe(
      "2026-08-24T00:00:00.000Z",
    );
  });

  it("Pazar 23:00 Istanbul hâlâ eski haftadadır", () => {
    // 2026-08-23T20:00Z = 23:00 Istanbul, Pazar
    expect(iso(getWeekStart(new Date("2026-08-23T20:00:00.000Z")))).toBe(
      "2026-08-17T00:00:00.000Z",
    );
  });

  it("ay ve yıl sınırını aşabilir", () => {
    // 2027-01-01 Cuma → 2026-12-28 Pazartesi
    expect(iso(getWeekStart(new Date("2027-01-01T12:00:00.000Z")))).toBe(
      "2026-12-28T00:00:00.000Z",
    );
  });
});

describe("getWeekStartInstant", () => {
  it("Istanbul'da Pazartesi 00:00 anını verir (UTC Pazar 21:00)", () => {
    expect(iso(getWeekStartInstant(new Date("2026-08-19T09:00:00.000Z")))).toBe(
      "2026-08-16T21:00:00.000Z",
    );
  });

  it("etiketten tam olarak saat farkı kadar geridedir", () => {
    const now = new Date("2026-08-19T09:00:00.000Z");
    const diffHours =
      (getWeekStart(now).getTime() - getWeekStartInstant(now).getTime()) /
      3_600_000;
    expect(diffHours).toBe(3);
  });

  it("Pazartesi 00:30 Istanbul'da yapılan kayıt aralığın içinde kalır", () => {
    // 2026-08-23T21:30Z = 2026-08-24 Pazartesi 00:30 Istanbul
    const loggedAt = new Date("2026-08-23T21:30:00.000Z");
    expect(getWeekStartInstant(loggedAt).getTime()).toBeLessThanOrEqual(
      loggedAt.getTime(),
    );
  });
});

describe("toGymDateKey", () => {
  it("Istanbul takvim gününü döner, UTC gününü değil", () => {
    expect(toGymDateKey(new Date("2026-08-23T22:00:00.000Z"))).toBe(
      "2026-08-24",
    );
  });
});

describe("formatDateTR", () => {
  it("hafta etiketini (UTC gece yarısı) aynı günle gösterir", () => {
    expect(formatDateTR(new Date("2026-08-17T00:00:00.000Z"))).toContain("17");
  });
});

describe("formatTimeTR", () => {
  it("saati salon saat dilimine çevirir", () => {
    // 16:00 UTC = 19:00 Istanbul
    expect(formatTimeTR(new Date("2026-08-18T16:00:00.000Z"))).toBe("19:00");
  });
});

describe("gymDayOfWeek", () => {
  it("Pazartesi'ye 1, Pazar'a 7 verir", () => {
    expect(gymDayOfWeek(new Date("2026-08-17T12:00:00.000Z"))).toBe(1);
    expect(gymDayOfWeek(new Date("2026-08-23T12:00:00.000Z"))).toBe(7);
  });

  it("gece yarısını salon saatine göre sayar", () => {
    // 2026-08-23T22:00Z = Pazartesi 01:00 Istanbul
    expect(gymDayOfWeek(new Date("2026-08-23T22:00:00.000Z"))).toBe(1);
  });
});

describe("gymDateTimeToInstant", () => {
  it("salon saatindeki gün+saati doğru ana çevirir", () => {
    expect(gymDateTimeToInstant("2026-08-18", "19:00").toISOString()).toBe(
      "2026-08-18T16:00:00.000Z",
    );
  });

  it("çevirdiği anı geri okuduğunda aynı saati verir", () => {
    const instant = gymDateTimeToInstant("2026-12-31", "07:30");
    expect(formatTimeTR(instant)).toBe("07:30");
  });
});
