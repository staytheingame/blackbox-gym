import { describe, expect, it } from "vitest";
import type { StimulusKind, TrialStimulus } from "../camera-fight-lab/types";
import { attackSideForStimulus, choreographyFrame } from "./choreography";

function stimulus(overrides: Partial<TrialStimulus> & { kind: StimulusKind }): TrialStimulus {
  return {
    requiredHand: "either",
    cueLabel: "VUR",
    cueColor: "#f5c400",
    peripheralZone: null,
    peripheralSide: null,
    peripheralEccentricity: null,
    inhibitionWindowMs: null,
    comboSequence: null,
    defenseAction: null,
    virtualOpponentAttackType: null,
    virtualOpponentResponseChannel: null,
    virtualOpponentTempoLevel: null,
    ...overrides,
  };
}

describe("attackSideForStimulus", () => {
  it("kaçış yönünün karşısındaki elle vurur", () => {
    const slipLeft = stimulus({
      kind: "VIRTUAL_OPPONENT",
      virtualOpponentResponseChannel: "DEFEND",
      defenseAction: "SLIP_LEFT",
    });
    const slipRight = stimulus({
      kind: "VIRTUAL_OPPONENT",
      virtualOpponentResponseChannel: "DEFEND",
      defenseAction: "SLIP_RIGHT",
    });
    expect(attackSideForStimulus(slipLeft)).toBe("right");
    expect(attackSideForStimulus(slipRight)).toBe("left");
  });

  it("çömelmede merkezden kavisli vuruş gelir", () => {
    expect(
      attackSideForStimulus(
        stimulus({
          kind: "VIRTUAL_OPPONENT",
          virtualOpponentResponseChannel: "DEFEND",
          defenseAction: "DUCK",
        }),
      ),
    ).toBe("center");
  });

  it("kontra kanalında ayna mantığı uygular", () => {
    expect(
      attackSideForStimulus(
        stimulus({
          kind: "VIRTUAL_OPPONENT",
          virtualOpponentResponseChannel: "COUNTER",
          comboSequence: ["left"],
        }),
      ),
    ).toBe("right");
    expect(
      attackSideForStimulus(
        stimulus({
          kind: "VIRTUAL_OPPONENT",
          virtualOpponentResponseChannel: "COUNTER",
          comboSequence: ["right"],
        }),
      ),
    ).toBe("left");
  });
});

describe("choreographyFrame", () => {
  const timeline = { cueStartMs: 1_000, attackCommitMs: 1_500, attackLandMs: 2_300 };

  it("commit öncesi yüklenme oynatır ve tehdit yarıyı geçmez", () => {
    const frame = choreographyFrame({
      ...timeline,
      nowMs: 1_250,
      resolvedAtMs: null,
      playerWon: false,
    });
    expect(frame.action).toBe("TELEGRAPH");
    expect(frame.progress).toBeCloseTo(0.5, 5);
    expect(frame.threat).toBeLessThanOrEqual(0.5);
  });

  it("commit sonrası vuruş yola çıkar ve tehdit artar", () => {
    const early = choreographyFrame({
      ...timeline,
      nowMs: 1_600,
      resolvedAtMs: null,
      playerWon: false,
    });
    const late = choreographyFrame({
      ...timeline,
      nowMs: 2_200,
      resolvedAtMs: null,
      playerWon: false,
    });
    expect(early.action).toBe("COMMIT");
    expect(late.threat).toBeGreaterThan(early.threat);
    expect(late.threat).toBeLessThanOrEqual(1);
  });

  it("çözüm sonrası kazanana göre farklı animasyon oynar", () => {
    const won = choreographyFrame({
      ...timeline,
      nowMs: 1_900,
      resolvedAtMs: 1_800,
      playerWon: true,
    });
    const lost = choreographyFrame({
      ...timeline,
      nowMs: 1_900,
      resolvedAtMs: 1_800,
      playerWon: false,
    });
    expect(won.action).toBe("BEATEN");
    expect(lost.action).toBe("LAND");
    expect(won.threat).toBe(0);
  });

  it("ilerleme 1'i aşmaz", () => {
    const frame = choreographyFrame({
      ...timeline,
      nowMs: 99_000,
      resolvedAtMs: null,
      playerWon: false,
    });
    expect(frame.progress).toBe(1);
  });
});
