import { describe, expect, it } from "vitest";
import {
  evaluateRankProgress,
  nextRankAfter,
  weeksBetween,
  type RequirementState,
} from "./progress";

const req = (id: string, done: boolean): RequirementState => ({
  id,
  kind: "teknik",
  label: id,
  done,
});

describe("evaluateRankProgress", () => {
  it("üç kapı da açıkken hazır sayar", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 16, minWeeks: 8 },
      requirements: [req("jab", true), req("cross", true)],
      attendedSessions: 20,
      weeksSinceLastAward: 10,
    });

    expect(progress.ready).toBe(true);
    expect(progress.missing).toEqual([]);
    expect(progress.percent).toBe(100);
  });

  it("tek kapı kapalıysa hazır saymaz ve eksiği yazar", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 16, minWeeks: 8 },
      requirements: [req("jab", true), req("cross", true)],
      attendedSessions: 12,
      weeksSinceLastAward: 10,
    });

    expect(progress.ready).toBe(false);
    expect(progress.sessionsMet).toBe(false);
    expect(progress.missing).toContain("4 ders");
  });

  it("eksik müfredat maddesini sayar", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 0, minWeeks: 0 },
      requirements: [req("jab", true), req("cross", false), req("hook", false)],
      attendedSessions: 0,
      weeksSinceLastAward: 0,
    });

    expect(progress.requirementsDone).toBe(1);
    expect(progress.requirementsTotal).toBe(3);
    expect(progress.missing).toContain("2 müfredat maddesi");
  });

  it("eşiği sıfır olan ölçüt yüzdeye karışmaz", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 10, minWeeks: 0 },
      requirements: [],
      attendedSessions: 5,
      weeksSinceLastAward: 0,
    });

    // Yalnız ders kapısı sayılır: 5/10 = yüzde 50.
    expect(progress.percent).toBe(50);
    expect(progress.weeksMet).toBe(true);
  });

  it("hiç kapısı olmayan kuşak doğrudan hazırdır", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 0, minWeeks: 0 },
      requirements: [],
      attendedSessions: 0,
      weeksSinceLastAward: 0,
    });

    expect(progress.ready).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it("fazladan ders yüzdeyi tavanın üstüne çıkarmaz", () => {
    const progress = evaluateRankProgress({
      gate: { minSessions: 10, minWeeks: 4 },
      requirements: [req("jab", true)],
      attendedSessions: 100,
      weeksSinceLastAward: 40,
    });

    expect(progress.percent).toBe(100);
  });
});

describe("weeksBetween", () => {
  it("tam haftayı sayar, eksiğini saymaz", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(weeksBetween(from, new Date("2026-01-14T23:00:00.000Z"))).toBe(1);
    expect(weeksBetween(from, new Date("2026-01-15T00:00:00.000Z"))).toBe(2);
  });

  it("gelecekteki tarih için 0 döner", () => {
    expect(weeksBetween(new Date("2026-05-01"), new Date("2026-04-01"))).toBe(0);
  });
});

describe("nextRankAfter", () => {
  const ladder = [
    { order: 0, isActive: true, slug: "beyaz" },
    { order: 1, isActive: true, slug: "sari" },
    { order: 2, isActive: false, slug: "turuncu" },
    { order: 3, isActive: true, slug: "yesil" },
  ];

  it("kuşağı olmayan sporcuya ilk basamağı verir", () => {
    expect(nextRankAfter(ladder, null)?.slug).toBe("beyaz");
  });

  it("bir sonraki basamağı verir", () => {
    expect(nextRankAfter(ladder, 0)?.slug).toBe("sari");
  });

  it("pasif kuşağı atlar", () => {
    expect(nextRankAfter(ladder, 1)?.slug).toBe("yesil");
  });

  it("merdivenin sonunda null döner", () => {
    expect(nextRankAfter(ladder, 3)).toBeNull();
  });
});
