import { describe, expect, it } from "vitest";
import { cueBeep, cueSpeech, feedbackBeep, speakCombo, speakDefenseAction } from "./audioCues";
import type { StimulusKind, TrialStimulus } from "./types";

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

describe("cueSpeech", () => {
  it("basit ve go cue'sunu VUR olarak okur", () => {
    expect(cueSpeech(stimulus({ kind: "SIMPLE" }))).toBe("Vur");
    expect(cueSpeech(stimulus({ kind: "GO" }))).toBe("Vur");
  });

  it("no-go cue'sunda DUR der", () => {
    expect(cueSpeech(stimulus({ kind: "NO_GO", requiredHand: "none" }))).toBe("Dur");
  });

  it("choice cue'sunda gereken eli söyler", () => {
    expect(cueSpeech(stimulus({ kind: "CHOICE", requiredHand: "left" }))).toBe("Sol");
    expect(cueSpeech(stimulus({ kind: "CHOICE", requiredHand: "right" }))).toBe("Sağ");
  });

  it("peripheral cue'sunda YÖN SIZDIRMAZ — çevresel görüş testi bozulmasın", () => {
    expect(
      cueSpeech(
        stimulus({ kind: "PERIPHERAL", peripheralZone: "outer-left", peripheralSide: "left" }),
      ),
    ).toBeNull();
  });

  it("combo sekansını sırayla okur", () => {
    expect(cueSpeech(stimulus({ kind: "COMBO", comboSequence: ["left", "right", "left"] }))).toBe(
      "Sol Sağ Sol",
    );
  });

  it("defans cue'sunda hareketi söyler", () => {
    expect(cueSpeech(stimulus({ kind: "DEFENSE", defenseAction: "SLIP_LEFT" }))).toBe("Sola slip");
    expect(cueSpeech(stimulus({ kind: "DEFENSE", defenseAction: "DUCK" }))).toBe("Çömel");
  });

  it("sanal rakipte kanala göre kontra ya da savunma okur", () => {
    expect(
      cueSpeech(
        stimulus({
          kind: "VIRTUAL_OPPONENT",
          virtualOpponentResponseChannel: "COUNTER",
          comboSequence: ["right"],
        }),
      ),
    ).toBe("Sağ");
    expect(
      cueSpeech(
        stimulus({
          kind: "VIRTUAL_OPPONENT",
          virtualOpponentResponseChannel: "DEFEND",
          defenseAction: "SLIP_RIGHT",
        }),
      ),
    ).toBe("Sağa slip");
  });
});

describe("cueBeep", () => {
  it("sanal rakipte saldırı sesi, diğerlerinde başlangıç sesi çalar", () => {
    expect(cueBeep(stimulus({ kind: "VIRTUAL_OPPONENT" }))).toBe("attack");
    expect(cueBeep(stimulus({ kind: "SIMPLE" }))).toBe("go");
  });
});

describe("feedbackBeep", () => {
  it("geri bildirim tonunu efekt sesine çevirir", () => {
    expect(feedbackBeep({ text: "HIT", tone: "hit" })).toBe("hit");
    expect(feedbackBeep({ text: "MISS", tone: "miss" })).toBe("miss");
    expect(feedbackBeep({ text: "EARLY", tone: "early" })).toBe("wrong");
    expect(feedbackBeep({ text: "TOO SLOW", tone: "slow" })).toBe("miss");
  });

  it("takip uyarısı ve boş geri bildirim sessizdir", () => {
    expect(feedbackBeep({ text: "TRACKING", tone: "tracking" })).toBeNull();
    expect(feedbackBeep(null)).toBeNull();
  });
});

describe("yardımcılar", () => {
  it("savunma hareketlerini Türkçe okur", () => {
    expect(speakDefenseAction("SLIP_RIGHT")).toBe("Sağa slip");
  });

  it("boş sekansta boş metin döner", () => {
    expect(speakCombo([])).toBe("");
  });
});
