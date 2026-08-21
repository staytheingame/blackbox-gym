import { describe, expect, it } from "vitest";
import {
  pointsForCheckIn,
  pointsForTrainingLog,
  pointsForTrainingRevert,
} from "./points";

describe("pointsForCheckIn", () => {
  it("normal skorda yalnız temel puanı verir", () => {
    const events = pointsForCheckIn({ consecutiveWeeks: 1, overallScore: 60 });
    expect(events).toEqual([{ action: "checkin_submitted", points: 10 }]);
  });

  it("4 haftalık seride bonus ekler", () => {
    const events = pointsForCheckIn({ consecutiveWeeks: 4, overallScore: 60 });
    expect(events.map((e) => e.action)).toContain("streak_bonus_4_weeks");
  });

  it("yüksek skorda bonus ekler", () => {
    const events = pointsForCheckIn({ consecutiveWeeks: 1, overallScore: 90 });
    expect(events.map((e) => e.action)).toContain("high_score_bonus");
  });

  it("8. haftada da seri bonusu tekrar tetiklenir (mod 4)", () => {
    const events = pointsForCheckIn({ consecutiveWeeks: 8, overallScore: 60 });
    expect(events.map((e) => e.action)).toContain("streak_bonus_4_weeks");
  });
});

describe("pointsForTrainingLog", () => {
  it("sabit training_logged puanı döner", () => {
    expect(pointsForTrainingLog()).toEqual([
      { action: "training_logged", points: 5 },
    ]);
  });
});

describe("pointsForTrainingRevert", () => {
  it("verilen puanı tam olarak sıfırlar", () => {
    const given = pointsForTrainingLog()[0].points;
    const taken = pointsForTrainingRevert()[0].points;
    expect(given + taken).toBe(0);
  });

  it("ters kaydı ayrı bir eylem adıyla yazar", () => {
    expect(pointsForTrainingRevert()[0].action).toBe("training_reverted");
  });
});
