import { describe, expect, it } from "vitest";
import { pickNextMove, pickIntervalMs, summarizeSession } from "./session";
import { REFLEX_MOVES } from "./moves";

describe("pickNextMove", () => {
  it("önceki hamleyle aynısını asla vermez", () => {
    let previous: string | null = null;
    let rngCallIndex = 0;
    const rng = () => {
      rngCallIndex += 1;
      return (rngCallIndex % 7) / 7;
    };
    for (let i = 0; i < 50; i++) {
      const move = pickNextMove(previous, rng);
      expect(move.id).not.toBe(previous);
      previous = move.id;
    }
  });

  it("rng=0 iken listenin ilk öğesini döner (önceki yoksa)", () => {
    const move = pickNextMove(null, () => 0);
    expect(move.id).toBe(REFLEX_MOVES[0].id);
  });
});

describe("pickIntervalMs", () => {
  it("kolay seviyede 3000-5000 aralığında döner", () => {
    const min = pickIntervalMs("kolay", () => 0);
    const max = pickIntervalMs("kolay", () => 0.999999);
    expect(min).toBeGreaterThanOrEqual(3000);
    expect(max).toBeLessThanOrEqual(5000);
  });

  it("zor seviyede daha kısa aralık döner", () => {
    const value = pickIntervalMs("zor", () => 0.5);
    expect(value).toBeGreaterThanOrEqual(1000);
    expect(value).toBeLessThanOrEqual(2500);
  });
});

describe("summarizeSession", () => {
  it("boş listede sıfır özet döner", () => {
    const summary = summarizeSession([]);
    expect(summary.repCount).toBe(0);
    expect(summary.averageMs).toBe(0);
  });

  it("ortalama/en iyi/en kötü doğru hesaplanır", () => {
    const summary = summarizeSession([
      { moveId: "sol-jab", reactionMs: 400 },
      { moveId: "sag-direkt", reactionMs: 600 },
      { moveId: "sol-jab", reactionMs: 200 },
    ]);
    expect(summary.repCount).toBe(3);
    expect(summary.bestMs).toBe(200);
    expect(summary.worstMs).toBe(600);
    expect(summary.averageMs).toBe(400);
  });

  it("hamle bazlı istatistikleri en hızlıdan yavaşa sıralar", () => {
    const summary = summarizeSession([
      { moveId: "sol-jab", reactionMs: 500 },
      { moveId: "sag-direkt", reactionMs: 300 },
    ]);
    expect(summary.perMove[0].moveId).toBe("sag-direkt");
    expect(summary.perMove[0].label).toBe("Sağ Direkt");
    expect(summary.perMove[1].moveId).toBe("sol-jab");
  });
});
