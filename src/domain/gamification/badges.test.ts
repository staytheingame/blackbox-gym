import { describe, expect, it } from "vitest";
import { evaluateNewBadges } from "./badges";

describe("evaluateNewBadges", () => {
  it("ilk check-in'de ilk-yumruk rozetini verir", () => {
    const badges = evaluateNewBadges({
      totalCheckIns: 1,
      consecutiveWeeks: 1,
      totalTrainingLogs: 0,
      latestOverallScore: 50,
      alreadyAwarded: [],
    });
    expect(badges).toEqual(["ilk-yumruk"]);
  });

  it("zaten verilmiş rozeti tekrar döndürmez", () => {
    const badges = evaluateNewBadges({
      totalCheckIns: 5,
      consecutiveWeeks: 1,
      totalTrainingLogs: 0,
      latestOverallScore: 50,
      alreadyAwarded: ["ilk-yumruk"],
    });
    expect(badges).toEqual([]);
  });

  it("eşik değerlerde birden çok rozet aynı anda verilebilir", () => {
    const badges = evaluateNewBadges({
      totalCheckIns: 4,
      consecutiveWeeks: 4,
      totalTrainingLogs: 10,
      latestOverallScore: 85,
      alreadyAwarded: [],
    });
    expect(badges).toEqual(
      expect.arrayContaining([
        "ilk-yumruk",
        "dort-hafta-seri",
        "on-antrenman",
        "yuksek-performans",
      ]),
    );
    expect(badges).toHaveLength(4);
  });
});
