import { describe, expect, it } from "vitest";
import type { FightAnalysisReport } from "./metrics";
import { spokenReportSummary, weakestLink } from "./narration";

function report(overrides: Partial<FightAnalysisReport> = {}): FightAnalysisReport {
  return {
    personDetected: true,
    frameCount: 300,
    validFrameCount: 290,
    durationSec: 60,
    guardScore: 70,
    guardDropFrameRatio: 0.2,
    footworkScore: 80,
    movementIndex: 0.5,
    headSlipCount: 12,
    headActivityScore: 65,
    stanceRatio: 1.4,
    overallScore: 72,
    ...overrides,
  };
}

describe("weakestLink", () => {
  it("en düşük alt skoru seçer", () => {
    expect(weakestLink(report({ guardScore: 90, footworkScore: 40, headActivityScore: 80 }))).toBe(
      "footwork",
    );
    expect(weakestLink(report({ guardScore: 30, footworkScore: 40, headActivityScore: 80 }))).toBe(
      "guard",
    );
    expect(weakestLink(report({ guardScore: 90, footworkScore: 85, headActivityScore: 20 }))).toBe(
      "head",
    );
  });

  it("beraberlikte gard önceliklidir", () => {
    expect(weakestLink(report({ guardScore: 50, footworkScore: 50, headActivityScore: 50 }))).toBe(
      "guard",
    );
  });
});

describe("spokenReportSummary", () => {
  it("skorları ve en zayıf halkayı okur", () => {
    const text = spokenReportSummary(
      report({ overallScore: 64, guardScore: 55, footworkScore: 80, headActivityScore: 70 }),
    );
    expect(text).toContain("Genel skor 64");
    expect(text).toContain("Gard 55");
    expect(text).toContain("En zayıf halka gard");
  });

  it("kişi tespit edilemediğinde ne yapılacağını söyler", () => {
    const text = spokenReportSummary(report({ personDetected: false }));
    expect(text).toContain("tespit edilemedi");
    expect(text).not.toContain("Genel skor");
  });
});
