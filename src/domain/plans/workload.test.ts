import { describe, expect, it } from "vitest";
import { summarizePlanDay, type PlanItemWorkload } from "./workload";

const item = (partial: Partial<PlanItemWorkload> = {}): PlanItemWorkload => ({
  kind: "torba",
  rounds: null,
  durationSeconds: null,
  restSeconds: null,
  targetRpe: null,
  ...partial,
});

describe("summarizePlanDay", () => {
  it("round başına süre + dinlenmeyi toplar", () => {
    const summary = summarizePlanDay(
      [
        item({ rounds: 6, durationSeconds: 180, restSeconds: 60 }), // 24 dk
        item({ rounds: 4, durationSeconds: 180, restSeconds: 60 }), // 16 dk
      ],
      "antrenman",
    );

    expect(summary.durationMinutes).toBe(40);
    expect(summary.rounds).toBe(10);
  });

  it("hedef RPE'lerin ortalamasını şiddet olarak alır", () => {
    const summary = summarizePlanDay(
      [
        item({ rounds: 3, durationSeconds: 180, targetRpe: 7 }),
        item({ rounds: 3, durationSeconds: 180, targetRpe: 8 }),
        item({ rounds: 3, durationSeconds: 180 }), // RPE yok — ortalamaya girmez
      ],
      "antrenman",
    );

    expect(summary.intensity).toBe(8); // (7+8)/2 = 7.5 → 8
  });

  it("süre yazılmamış günde varsayılan seans uzunluğunu kullanır", () => {
    const summary = summarizePlanDay(
      [item({ kind: "teknik" }), item({ kind: "esneme" })],
      "antrenman",
    );

    expect(summary.durationMinutes).toBe(45);
    expect(summary.rounds).toBe(0);
    expect(summary.intensity).toBe(6);
  });

  it("boş güne de geçerli bir kayıt üretir", () => {
    const summary = summarizePlanDay([], "antrenman");

    expect(summary.durationMinutes).toBeGreaterThanOrEqual(5);
    expect(summary.intensity).toBeGreaterThanOrEqual(1);
    expect(summary.intensity).toBeLessThanOrEqual(10);
  });

  it("elle loglamanın üst sınırını (300 dk) aşmaz", () => {
    const summary = summarizePlanDay(
      [item({ rounds: 50, durationSeconds: 600, restSeconds: 120 })],
      "antrenman",
    );

    expect(summary.durationMinutes).toBe(300);
  });

  it("şablon türü kondisyonsa antrenman tipini kondisyon yazar", () => {
    expect(summarizePlanDay([], "kondisyon").type).toBe("kondisyon");
    expect(summarizePlanDay([], "antrenman").type).toBe("boks");
  });

  it("sıfır/negatif round değerlerini saymaz", () => {
    const summary = summarizePlanDay(
      [item({ rounds: 0, durationSeconds: 300 })],
      "antrenman",
    );

    expect(summary.rounds).toBe(0);
    expect(summary.durationMinutes).toBe(5);
  });
});
