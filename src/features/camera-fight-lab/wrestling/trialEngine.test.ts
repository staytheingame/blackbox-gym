import { describe, expect, it } from "vitest";
import { evaluateWrestlingCalibration } from "./calibration";
import { wrestlingMotionPose, wrestlingPose } from "./fixtures";
import { buildWrestlingSessionSummary } from "./metrics";
import { generateWrestlingStimulus, wrestlingProtocolConfigHash } from "./protocols";
import { WrestlingTrialEngine } from "./trialEngine";
import type { WrestlingProtocolId, WrestlingStimulus, WrestlingTrial } from "./protocolTypes";

const camera = { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 };
const calibrationSamples = Array.from({ length: 50 }, (_, index) => wrestlingPose(index * 33));
const calibration = evaluateWrestlingCalibration(calibrationSamples, camera, calibrationSamples.at(-1)!.timestampMs).snapshot!;

const run = (protocolId: WrestlingProtocolId, stimulus: WrestlingStimulus, motion: Array<{ at: number; dx?: number; dy?: number; torsoLean?: number; stanceDelta?: number }>): WrestlingTrial => {
  const t0 = 2_000;
  const engine = new WrestlingTrialEngine({ trialIndex: 0, protocolId, stimulus, calibration, t0Ms: t0 });
  engine.update(wrestlingMotionPose(t0));
  let result: WrestlingTrial | null = null;
  for (const frame of motion) {
    result = engine.update(wrestlingMotionPose(t0 + frame.at, frame));
    if (result) break;
  }
  return result ?? engine.forceTimeout(t0 + 7_000);
};

const recoveryFrames = [
  { at: 600 }, { at: 633 }, { at: 666 }, { at: 699 }, { at: 732 }, { at: 765 },
];

describe("W1 shot reaction", () => {
  it("detects multi-joint left response T1/T2 and stable T3 recovery", () => {
    const trial = run("shot-reaction", { kind: "SHOT", attack: "LEFT_SINGLE", requiredDirection: "LEFT" }, [
      { at: 100, dx: -0.03 }, { at: 133, dx: -0.09 }, { at: 166, dx: -0.1 }, ...recoveryFrames,
    ]);
    expect(trial.type).toBe("shot");
    expect(trial.outcome).toBe("CORRECT");
    expect(trial.t1Ms).toBe(2_100);
    expect(trial.t2Ms).not.toBeNull();
    expect(trial.t3Ms).not.toBeNull();
  });

  it("keeps wrong direction visible rather than hiding the trial", () => {
    const trial = run("shot-reaction", { kind: "SHOT", attack: "LEFT_SINGLE", requiredDirection: "LEFT" }, [
      { at: 100, dx: 0.03 }, { at: 133, dx: 0.09 }, { at: 166, dx: 0.1 }, ...recoveryFrames,
    ]);
    expect(trial.outcome).toBe("WRONG_DIRECTION");
    expect(trial.qualityFlags).toContain("RESPONSE_DIRECTION_UNCLEAR");
  });
});

describe("W2 sprawl reaction", () => {
  it("requires multiple sprawl signals and records recovery", () => {
    const trial = run("sprawl-reaction", { kind: "SPRAWL", attack: "DOUBLE_LEG", requiredDirection: "SPRAWL" }, [
      { at: 100, dy: 0.03, torsoLean: 0.04 },
      { at: 133, dy: 0.08, torsoLean: 0.08, stanceDelta: 0.03 },
      { at: 166, dy: 0.09, torsoLean: 0.09, stanceDelta: 0.04 },
      ...recoveryFrames,
    ]);
    expect(trial.type).toBe("sprawl");
    if (trial.type === "sprawl") {
      expect(trial.sprawlSignalsPassed).toBeGreaterThanOrEqual(2);
      expect(trial.recovered).toBe(true);
    }
  });

  it("does not classify a single-landmark-sized drift as a sprawl", () => {
    const trial = run("sprawl-reaction", { kind: "SPRAWL", attack: "DOUBLE_LEG", requiredDirection: "SPRAWL" }, [
      { at: 100, dy: 0.01 }, { at: 133, dy: 0.015 }, { at: 3_500, dy: 0.015 },
    ]);
    expect(trial.outcome).toBe("NO_RESPONSE");
    expect(trial.qualityFlags).toContain("SPRAWL_NOT_DETECTED");
  });
});

describe("W3-W4 decision and fake recognition", () => {
  it("maps double-leg choice to sprawl and records a correct response", () => {
    const trial = run("wrestling-choice", { kind: "CHOICE", attack: "DOUBLE_LEG", requiredDirection: "SPRAWL" }, [
      { at: 100, dy: 0.03, torsoLean: 0.04 }, { at: 133, dy: 0.08, torsoLean: 0.08, stanceDelta: 0.03 }, { at: 166, dy: 0.09, torsoLean: 0.09, stanceDelta: 0.04 }, ...recoveryFrames,
    ]);
    expect(trial.type).toBe("choice");
    expect(trial.correct).toBe(true);
  });

  it("records correct restraint and false defense separately", () => {
    const restraint = run("fake-real-recognition", { kind: "RECOGNITION", cue: "FAKE", attack: null, requiredDirection: "RESTRAINT" }, [
      { at: 400 }, { at: 800 }, { at: 1_200 },
    ]);
    expect(restraint.type).toBe("recognition");
    if (restraint.type === "recognition") expect(restraint.classification).toBe("CORRECT_RESTRAINT");

    const falseDefense = run("fake-real-recognition", { kind: "RECOGNITION", cue: "FAKE", attack: null, requiredDirection: "RESTRAINT" }, [
      { at: 100, dx: -0.04 }, { at: 133, dx: -0.09 },
    ]);
    expect(falseDefense.outcome).toBe("FALSE_DEFENSE");
  });
});

describe("W5-W6 movement and stance consistency", () => {
  it("detects valid left/right movement and wrong direction", () => {
    const left = run("movement-lab", { kind: "MOVEMENT", command: "LEFT", requiredDirection: "LEFT" }, [
      { at: 100, dx: -0.03 }, { at: 133, dx: -0.09 }, { at: 166, dx: -0.1 }, ...recoveryFrames,
    ]);
    expect(left.correct).toBe(true);
    const wrong = run("movement-lab", { kind: "MOVEMENT", command: "RIGHT", requiredDirection: "RIGHT" }, [
      { at: 100, dx: -0.03 }, { at: 133, dx: -0.09 }, { at: 166, dx: -0.1 }, ...recoveryFrames,
    ]);
    expect(wrong.outcome).toBe("WRONG_DIRECTION");
  });

  it("produces a bounded stance consistency product metric", () => {
    const trial = run("stance-consistency", { kind: "STANCE", durationMs: 1_000 }, [
      { at: 200 }, { at: 400, dx: 0.002 }, { at: 600, dx: -0.002 }, { at: 800 }, { at: 1_000 },
    ]);
    expect(trial.type).toBe("stance");
    if (trial.type === "stance") expect(trial.stanceConsistencyPct).toBeGreaterThan(80);
  });
});

describe("W1-W6 protocol and summary contracts", () => {
  it("generates bounded protocol-specific stimuli and stable config hashes", () => {
    expect(generateWrestlingStimulus("shot-reaction", () => 0)).toMatchObject({ kind: "SHOT", attack: "LEFT_SINGLE" });
    expect(generateWrestlingStimulus("fake-real-recognition", () => 0)).toMatchObject({ kind: "RECOGNITION", cue: "FAKE" });
    expect(wrestlingProtocolConfigHash("shot-reaction")).toBe(wrestlingProtocolConfigHash("shot-reaction"));
    expect(wrestlingProtocolConfigHash("shot-reaction")).not.toBe(wrestlingProtocolConfigHash("sprawl-reaction"));
  });

  it("reports raw timing, side difference and false-defense rate without diagnostic labels", () => {
    const left = run("shot-reaction", { kind: "SHOT", attack: "LEFT_SINGLE", requiredDirection: "LEFT" }, [
      { at: 100, dx: -0.03 }, { at: 133, dx: -0.09 }, { at: 166, dx: -0.1 }, ...recoveryFrames,
    ]);
    const right = run("shot-reaction", { kind: "SHOT", attack: "RIGHT_SINGLE", requiredDirection: "RIGHT" }, [
      { at: 140, dx: 0.03 }, { at: 173, dx: 0.09 }, { at: 206, dx: 0.1 }, ...recoveryFrames.map((frame) => ({ ...frame, at: frame.at + 60 })),
    ]);
    const summary = buildWrestlingSessionSummary([left, right]);
    expect(summary.accuracyPct).toBe(100);
    expect(summary.absoluteDifferenceMs).toBeGreaterThan(0);
    expect(summary.relativeDifferencePct).toBeGreaterThan(0);
  });
});
