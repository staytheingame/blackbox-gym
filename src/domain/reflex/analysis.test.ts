import { describe, expect, it } from "vitest";
import { analyzeSession, buildRoundReport, summarizeSession, type ReflexRep } from "./session";

const rep = (overrides: Partial<ReflexRep> = {}): ReflexRep => ({
  moveId: "sol-jab",
  reactionMs: 400,
  roundIndex: 0,
  ...overrides,
});

describe("summarizeSession", () => {
  it("kaçan komutları zaman ortalamasına katmaz", () => {
    const summary = summarizeSession([
      rep({ reactionMs: 300 }),
      rep({ reactionMs: 500 }),
      rep({ reactionMs: 0, missed: true }),
    ]);
    expect(summary.repCount).toBe(2);
    expect(summary.averageMs).toBe(400);
    expect(summary.worstMs).toBe(500);
  });
});

describe("buildRoundReport", () => {
  it("hızlı ve tutarlı round yüksek odak skoru üretir", () => {
    const reps = [280, 300, 290, 310].map((ms) => rep({ reactionMs: ms }));
    const report = buildRoundReport(reps, "manuel");
    expect(report.averageMs).toBe(295);
    expect(report.speedScore).toBeGreaterThan(85);
    expect(report.consistencyScore).toBeGreaterThan(90);
    expect(report.focusScore).toBeGreaterThan(80);
  });

  it("dalgalı tepkilerde tutarlılık skoru düşer", () => {
    const steady = buildRoundReport([400, 410, 390, 400].map((ms) => rep({ reactionMs: ms })), "manuel");
    const erratic = buildRoundReport([200, 600, 250, 550].map((ms) => rep({ reactionMs: ms })), "manuel");
    expect(erratic.averageMs).toBe(steady.averageMs);
    expect(erratic.consistencyScore).toBeLessThan(steady.consistencyScore);
    expect(erratic.focusScore).toBeLessThan(steady.focusScore);
  });

  it("round içinde yavaşlama dayanıklılık skorunu düşürür", () => {
    const report = buildRoundReport(
      [250, 260, 450, 470].map((ms) => rep({ reactionMs: ms })),
      "manuel",
    );
    expect(report.fatigueDriftMs).toBeGreaterThan(150);
    expect(report.enduranceScore).toBeLessThan(30);
  });

  it("kamera modunda doğruluk ve guard disiplini raporlanır", () => {
    const report = buildRoundReport(
      [
        rep({ reactionMs: 320, verified: true, guardUpRatio: 1 }),
        rep({ reactionMs: 350, verified: true, guardUpRatio: 0.8 }),
        rep({ reactionMs: 380, verified: false, detectedMoveId: "sag-direkt", guardUpRatio: 0.6 }),
        rep({ reactionMs: 0, missed: true, verified: false, guardUpRatio: 0.2 }),
      ],
      "kamera",
    );
    expect(report.cueCount).toBe(4);
    expect(report.hitCount).toBe(2);
    expect(report.wrongMoveCount).toBe(1);
    expect(report.missCount).toBe(1);
    expect(report.accuracyScore).toBe(50);
    expect(report.guardScore).toBe(65);
  });

  it("manuel modda kamera metrikleri null kalır", () => {
    const report = buildRoundReport([rep()], "manuel");
    expect(report.accuracyScore).toBeNull();
    expect(report.guardScore).toBeNull();
  });

  it("hiç tepki alınmayan round sıfır skorla döner", () => {
    const report = buildRoundReport([rep({ missed: true }), rep({ missed: true })], "kamera");
    expect(report.focusScore).toBe(0);
    expect(report.missCount).toBe(2);
  });
});

describe("analyzeSession", () => {
  const session = (): ReflexRep[] => [
    ...[300, 320, 310, 330].map((ms) => rep({ reactionMs: ms, roundIndex: 0, verified: true })),
    ...[420, 450, 470, 500].map((ms) => rep({ reactionMs: ms, roundIndex: 1, verified: true })),
  ];

  it("round'ları ayırır ve düşen eğilimi yakalar", () => {
    const report = analyzeSession(session(), "kamera");
    expect(report.rounds.map((round) => round.roundIndex)).toEqual([0, 1]);
    expect(report.rounds[0].averageMs).toBeLessThan(report.rounds[1].averageMs);
    expect(report.bestRoundIndex).toBe(0);
    expect(report.worstRoundIndex).toBe(1);
    expect(report.focusTrend).toBe("dusen");
    expect(report.overall.cueCount).toBe(8);
  });

  it("son round ilk round'dan hızlıysa eğilim yükselen olur", () => {
    const report = analyzeSession(
      [
        ...[500, 520, 510, 530].map((ms) => rep({ reactionMs: ms, roundIndex: 0 })),
        ...[300, 310, 305, 315].map((ms) => rep({ reactionMs: ms, roundIndex: 1 })),
      ],
      "manuel",
    );
    expect(report.focusTrend).toBe("yukselen");
    expect(report.highlights.some((note) => note.includes("hızlı"))).toBe(true);
  });

  it("boş seansta çökmeden sıfır rapor verir", () => {
    const report = analyzeSession([], "manuel");
    expect(report.rounds).toEqual([]);
    expect(report.focusScore).toBe(0);
    expect(report.verdict.length).toBeGreaterThan(0);
  });
});
