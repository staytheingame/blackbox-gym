import { describe, expect, it } from "vitest";
import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { outcomeForNoGoWindow, outcomeForTargetHit } from "./decisionEngine";
import { createProtocolTrial, protocolConfigHash } from "./protocols";
import type { CalibrationSnapshot, TrialStimulus } from "./types";

const calibration: CalibrationSnapshot = {
  completedAt: 1,
  shoulderWidthM: 0.4,
  shoulderWidthNormalized: 0.2,
  leftShoulderWorld: { x: -0.2, y: 0.2, z: 0 },
  rightShoulderWorld: { x: 0.2, y: 0.2, z: 0 },
  leftShoulderImage: { x: 0.4, y: 0.35, z: 0 },
  rightShoulderImage: { x: 0.6, y: 0.35, z: 0 },
  leftGuardWorld: { x: -0.14, y: 0.18, z: 0 },
  rightGuardWorld: { x: 0.14, y: 0.18, z: 0 },
  leftGuardImage: { x: 0.43, y: 0.42, z: 0 },
  rightGuardImage: { x: 0.57, y: 0.42, z: 0 },
  torsoCenterWorld: { x: 0, y: 0.2, z: 0 },
  torsoCenterImage: { x: 0.42, y: 0.45, z: 0 },
  headNeutralWorld: { x: 0, y: 0.4, z: 0 },
  headNeutralImage: { x: 0.5, y: 0.28, z: 0 },
  leftWristNoiseM: 0.01,
  rightWristNoiseM: 0.01,
  camera: { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 },
  estimatedProcessingFps: 30,
};

const rngSequence = (...values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

const noGoStimulus = (): TrialStimulus => ({
  kind: "NO_GO",
  requiredHand: "none",
  cueLabel: "DUR",
  cueColor: "#ef4444",
  peripheralZone: null,
  peripheralSide: null,
  peripheralEccentricity: null,
  inhibitionWindowMs: PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs,
  comboSequence: null,
  defenseAction: null,
  virtualOpponentAttackType: null,
  virtualOpponentResponseChannel: null,
  virtualOpponentTempoLevel: null,
});

describe("Phase 1 protocol generation", () => {
  it("records canonical required hand and never lets display mirroring invert Choice logic", () => {
    const generated = createProtocolTrial({
      protocolId: "choice-reaction",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.2, 0.1, 0.3),
    });

    expect(generated.stimulus.requiredHand).toBe("left");
    expect(generated.stimulus.cueLabel).toBe("SOL");
    expect(outcomeForTargetHit(generated.stimulus, "left")).toBe("HIT");
    expect(outcomeForTargetHit(generated.stimulus, "right")).toBe("WRONG_HAND");
    expect(generated.target.displayX).toBeCloseTo(generated.target.normalizedX * 1000);
  });

  it("classifies movement inside the documented NO_GO window as a false attack", () => {
    const windowMs = PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs;
    expect(
      outcomeForNoGoWindow({ t0Ms: 1_000, inhibitionWindowMs: windowMs, movementOnsetMs: 1_250 }),
    ).toBe("FALSE_ATTACK");
    expect(
      outcomeForNoGoWindow({ t0Ms: 1_000, inhibitionWindowMs: windowMs, movementOnsetMs: null }),
    ).toBe("CORRECT_REJECT");
  });

  it("bounds consecutive NO_GO stimuli and retains the configured inhibition window", () => {
    const generated = createProtocolTrial({
      protocolId: "go-no-go",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [noGoStimulus(), noGoStimulus()],
      rng: rngSequence(0.2, 0, 0.4),
    });
    expect(generated.stimulus.kind).toBe("GO");

    const noGo = createProtocolTrial({
      protocolId: "go-no-go",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.2, 0, 0.4),
    });
    expect(noGo.stimulus.kind).toBe("NO_GO");
    expect(noGo.stimulus.inhibitionWindowMs).toBe(
      PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs,
    );
  });

  it("records peripheral side and eccentricity and avoids repeating the previous zone", () => {
    const previous = {
      ...noGoStimulus(),
      kind: "PERIPHERAL" as const,
      requiredHand: "either" as const,
      peripheralZone: "center" as const,
      peripheralSide: "center" as const,
      peripheralEccentricity: "center" as const,
    };
    const generated = createProtocolTrial({
      protocolId: "peripheral-reaction",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [previous],
      rng: rngSequence(0.3, 0),
    });
    expect(generated.stimulus.peripheralZone).toBe("inner-left");
    expect(generated.stimulus.peripheralSide).toBe("left");
    expect(generated.stimulus.peripheralEccentricity).toBe("inner");
    expect(generated.target.normalizedX).toBeLessThan(0.5);
  });

  it("produces stable, protocol-specific config hashes", () => {
    expect(protocolConfigHash("choice-reaction")).toBe(protocolConfigHash("choice-reaction"));
    expect(protocolConfigHash("choice-reaction")).not.toBe(protocolConfigHash("go-no-go"));
  });
});

describe("Phase 2 protocol generation", () => {
  it("generates a combo-speed stimulus with a preset hand sequence and matching label", () => {
    const generated = createProtocolTrial({
      protocolId: "combo-speed",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.2, 0.1, 0.4),
    });
    expect(generated.stimulus.kind).toBe("COMBO");
    expect(generated.stimulus.requiredHand).toBe("either");
    expect(generated.stimulus.comboSequence).not.toBeNull();
    expect(generated.stimulus.comboSequence!.length).toBeGreaterThanOrEqual(2);
    expect(generated.stimulus.cueLabel).toContain(
      generated.stimulus.comboSequence![0] === "left" ? "SOL" : "SAĞ",
    );
  });

  it("avoids repeating the immediately previous combo sequence", () => {
    const first = createProtocolTrial({
      protocolId: "combo-speed",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0),
    });
    const second = createProtocolTrial({
      protocolId: "combo-speed",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [first.stimulus],
      rng: rngSequence(0),
    });
    expect(second.stimulus.comboSequence).not.toEqual(first.stimulus.comboSequence);
  });

  it("generates a guard-return stimulus that reuses the standard punch target", () => {
    const generated = createProtocolTrial({
      protocolId: "guard-return",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.3),
    });
    expect(generated.stimulus.kind).toBe("GUARD_RETURN");
    expect(generated.stimulus.requiredHand).toBe("either");
    expect(generated.target.radiusPx).toBeGreaterThan(0);
  });
});

describe("Phase 4 virtual-opponent protocol generation", () => {
  it("generates a COUNTER-channel stimulus with a single-hand sequence and a hit-testable target", () => {
    // rng() order: targetDelayMs, attack type, tempo level, hand, then target selection.
    const generated = createProtocolTrial({
      protocolId: "virtual-opponent",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.5, 0, 0.1, 0.1, 0.4),
    });
    expect(generated.stimulus.kind).toBe("VIRTUAL_OPPONENT");
    expect(generated.stimulus.virtualOpponentAttackType).toBe("PUNCH_COMBO");
    expect(generated.stimulus.virtualOpponentResponseChannel).toBe("COUNTER");
    expect(generated.stimulus.virtualOpponentTempoLevel).not.toBeNull();
    expect(generated.stimulus.comboSequence).toEqual(["left"]);
    expect(generated.stimulus.defenseAction).toBeNull();
    expect(generated.target.radiusPx).toBeGreaterThan(0);
  });

  it("generates a DEFEND-channel stimulus with a defense action and a defense-cue target", () => {
    const generated = createProtocolTrial({
      protocolId: "virtual-opponent",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0.5, 0.9, 0.1, 0.1),
    });
    expect(generated.stimulus.kind).toBe("VIRTUAL_OPPONENT");
    expect(generated.stimulus.virtualOpponentAttackType).toBe("DEFEND_CUE");
    expect(generated.stimulus.virtualOpponentResponseChannel).toBe("DEFEND");
    expect(generated.stimulus.defenseAction).not.toBeNull();
    expect(generated.stimulus.comboSequence).toBeNull();
    // Defense-cue target is anchored to the calibrated head-neutral point, not the punch zones.
    expect(generated.target.zoneIndex).toBe(-1);
  });

  it("never repeats the immediately previous attack type", () => {
    const first = createProtocolTrial({
      protocolId: "virtual-opponent",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [],
      rng: rngSequence(0),
    });
    const second = createProtocolTrial({
      protocolId: "virtual-opponent",
      calibration,
      canvas: { width: 1000, height: 600 },
      previousZoneIndex: null,
      previousStimuli: [first.stimulus],
      rng: rngSequence(0),
    });
    expect(second.stimulus.virtualOpponentAttackType).not.toBe(
      first.stimulus.virtualOpponentAttackType,
    );
  });
});
