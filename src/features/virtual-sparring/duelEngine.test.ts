import { describe, expect, it } from "vitest";
import {
  applyExchange,
  comboMultiplier,
  duelVerdict,
  DUEL_CONFIG,
  INITIAL_DUEL_STATE,
  mistakeForOutcome,
  resolveExchange,
  speedBonus,
  summarizeDuel,
  type DuelExchange,
  type ExchangeInput,
} from "./duelEngine";

function input(overrides: Partial<ExchangeInput> = {}): ExchangeInput {
  return {
    index: 0,
    attackType: "PUNCH_COMBO",
    responseChannel: "COUNTER",
    outcome: "DEFEATED_ATTACK",
    reactionMs: 300,
    responseTimeMs: 480,
    beatDeadlineMarginMs: 200,
    ...overrides,
  };
}

function exchange(overrides: Partial<DuelExchange> = {}): DuelExchange {
  return {
    ...input(),
    mistake: null,
    scoreDelta: 100,
    playerDamage: 0,
    opponentDamage: 9,
    ...overrides,
  };
}

describe("mistakeForOutcome", () => {
  it("her sonucu bir hata kovasına koyar", () => {
    expect(mistakeForOutcome("DEFEATED_ATTACK")).toBeNull();
    expect(mistakeForOutcome("TOO_LATE")).toBe("LATE");
    expect(mistakeForOutcome("WRONG_RESPONSE")).toBe("WRONG");
    expect(mistakeForOutcome("NO_RESPONSE")).toBe("NONE");
  });
});

describe("comboMultiplier", () => {
  it("seri büyüdükçe artar ama tavanı aşmaz", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(2);
    expect(comboMultiplier(4)).toBe(3);
    expect(comboMultiplier(50)).toBe(DUEL_CONFIG.maxComboMultiplier);
  });
});

describe("speedBonus", () => {
  it("erken yetişmeyi ödüllendirir, geç kalmayı ödüllendirmez", () => {
    expect(speedBonus(null)).toBe(0);
    expect(speedBonus(-50)).toBe(0);
    expect(speedBonus(DUEL_CONFIG.fullSpeedBonusMarginMs)).toBe(DUEL_CONFIG.speedBonusScore);
    expect(speedBonus(DUEL_CONFIG.fullSpeedBonusMarginMs * 3)).toBe(DUEL_CONFIG.speedBonusScore);
  });

  it("yarı marj yarı bonus verir", () => {
    expect(speedBonus(DUEL_CONFIG.fullSpeedBonusMarginMs / 2)).toBe(
      Math.round(DUEL_CONFIG.speedBonusScore / 2),
    );
  });
});

describe("resolveExchange", () => {
  it("temiz yanıtta rakip hasar alır, sporcu almaz", () => {
    const result = resolveExchange(input(), INITIAL_DUEL_STATE);
    expect(result.mistake).toBeNull();
    expect(result.playerDamage).toBe(0);
    expect(result.opponentDamage).toBeGreaterThan(0);
    expect(result.scoreDelta).toBeGreaterThan(DUEL_CONFIG.cleanScore);
  });

  it("seri devam ederken puan çarpanı uygulanır", () => {
    const withoutCombo = resolveExchange(input(), INITIAL_DUEL_STATE);
    const withCombo = resolveExchange(input(), { ...INITIAL_DUEL_STATE, combo: 4 });
    expect(withCombo.scoreDelta).toBeGreaterThan(withoutCombo.scoreDelta);
  });

  it("yanıt yok, yanlış yanıt ve geç kalma farklı hasar verir", () => {
    const none = resolveExchange(input({ outcome: "NO_RESPONSE" }), INITIAL_DUEL_STATE);
    const wrong = resolveExchange(input({ outcome: "WRONG_RESPONSE" }), INITIAL_DUEL_STATE);
    const late = resolveExchange(input({ outcome: "TOO_LATE" }), INITIAL_DUEL_STATE);
    expect(none.playerDamage).toBeGreaterThan(late.playerDamage);
    expect(late.playerDamage).toBeGreaterThan(wrong.playerDamage);
    expect(none.scoreDelta).toBe(0);
  });
});

describe("applyExchange", () => {
  it("temiz yanıt seriyi büyütür", () => {
    const state = applyExchange(INITIAL_DUEL_STATE, exchange());
    expect(state.combo).toBe(1);
    expect(state.bestCombo).toBe(1);
    expect(state.opponentHealth).toBe(DUEL_CONFIG.startingHealth - 9);
  });

  it("hata seriyi sıfırlar ama en iyi seriyi korur", () => {
    let state = applyExchange(INITIAL_DUEL_STATE, exchange());
    state = applyExchange(state, exchange());
    state = applyExchange(state, exchange({ mistake: "LATE", scoreDelta: 0, opponentDamage: 0, playerDamage: 12 }));
    expect(state.combo).toBe(0);
    expect(state.bestCombo).toBe(2);
    expect(state.playerHealth).toBe(DUEL_CONFIG.startingHealth - 12);
  });

  it("can sıfırın altına inmez", () => {
    const state = applyExchange(
      { ...INITIAL_DUEL_STATE, playerHealth: 5 },
      exchange({ mistake: "NONE", scoreDelta: 0, opponentDamage: 0, playerDamage: 15 }),
    );
    expect(state.playerHealth).toBe(0);
  });
});

describe("duelVerdict", () => {
  it("canı biten tarafa göre karar verir", () => {
    expect(duelVerdict(INITIAL_DUEL_STATE)).toBeNull();
    expect(duelVerdict({ ...INITIAL_DUEL_STATE, opponentHealth: 0 })).toBe("PLAYER_WIN");
    expect(duelVerdict({ ...INITIAL_DUEL_STATE, playerHealth: 0 })).toBe("OPPONENT_WIN");
  });
});

describe("summarizeDuel", () => {
  it("boş seansta uydurma metrik üretmez", () => {
    const report = summarizeDuel([]);
    expect(report.exchanges).toBe(0);
    expect(report.cleanPct).toBe(0);
    expect(report.averageReactionMs).toBeNull();
    expect(report.topMistake).toBeNull();
  });

  it("ortalamayı yalnız temiz alışverişlerden alır", () => {
    const report = summarizeDuel([
      exchange({ reactionMs: 300 }),
      exchange({ reactionMs: 400 }),
      exchange({ mistake: "WRONG", reactionMs: 900, scoreDelta: 0, opponentDamage: 0 }),
    ]);
    expect(report.averageReactionMs).toBe(350);
    expect(report.fastestReactionMs).toBe(300);
    expect(report.slowestReactionMs).toBe(400);
    expect(report.cleanPct).toBe(67);
  });

  it("en sık hatayı ve en uzun temiz seriyi bulur", () => {
    const report = summarizeDuel([
      exchange(),
      exchange(),
      exchange({ mistake: "LATE", scoreDelta: 0, opponentDamage: 0 }),
      exchange({ mistake: "LATE", scoreDelta: 0, opponentDamage: 0 }),
      exchange({ mistake: "WRONG", scoreDelta: 0, opponentDamage: 0 }),
    ]);
    expect(report.topMistake).toBe("LATE");
    expect(report.mistakeCounts.LATE).toBe(2);
    expect(report.bestCombo).toBe(2);
  });

  it("iki kanal da denenmediyse zayıf kanal teşhisi uydurmaz", () => {
    const onlyCounter = summarizeDuel([exchange(), exchange({ mistake: "WRONG", scoreDelta: 0 })]);
    expect(onlyCounter.weakestChannel).toBeNull();
  });

  it("hata oranı yüksek kanalı zayıf sayar", () => {
    const report = summarizeDuel([
      exchange({ responseChannel: "COUNTER" }),
      exchange({ responseChannel: "COUNTER" }),
      exchange({ responseChannel: "DEFEND", mistake: "WRONG", scoreDelta: 0, opponentDamage: 0 }),
      exchange({ responseChannel: "DEFEND", mistake: "NONE", scoreDelta: 0, opponentDamage: 0 }),
    ]);
    expect(report.weakestChannel).toBe("DEFEND");
  });
});
