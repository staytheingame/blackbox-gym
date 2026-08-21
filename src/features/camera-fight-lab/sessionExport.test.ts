import { describe, expect, it } from "vitest";
import { buildSessionExport } from "./sessionExport";
import { buildSessionSummary } from "./sessionMetrics";
import type { CalibrationSnapshot, CameraSnapshot, TrialResult } from "./types";

const camera: CameraSnapshot = {
  deviceId: "camera-1",
  deviceLabel: "Test camera",
  width: 1280,
  height: 720,
  frameRate: 60,
  facingMode: "user",
};

const calibration: CalibrationSnapshot = {
  completedAt: 1_000,
  shoulderWidthM: 0.42,
  shoulderWidthNormalized: 0.21,
  leftShoulderWorld: { x: -0.2, y: 0, z: 0 },
  rightShoulderWorld: { x: 0.2, y: 0, z: 0 },
  leftShoulderImage: { x: 0.4, y: 0.35, z: 0 },
  rightShoulderImage: { x: 0.6, y: 0.35, z: 0 },
  leftGuardWorld: { x: -0.12, y: -0.12, z: -0.08 },
  rightGuardWorld: { x: 0.12, y: -0.12, z: -0.08 },
  leftGuardImage: { x: 0.44, y: 0.45, z: 0 },
  rightGuardImage: { x: 0.56, y: 0.45, z: 0 },
  torsoCenterWorld: { x: 0, y: 0.2, z: 0 },
  torsoCenterImage: { x: 0.5, y: 0.5, z: 0 },
  headNeutralWorld: { x: 0, y: 0.4, z: -0.05 },
  headNeutralImage: { x: 0.5, y: 0.3, z: 0 },
  leftWristNoiseM: 0.006,
  rightWristNoiseM: 0.007,
  camera,
  estimatedProcessingFps: 30,
};

const trial: TrialResult = {
  trialIndex: 0,
  protocolId: "full-reaction",
  protocolVersion: "1.0.0",
  stimulus: {
    kind: "SIMPLE",
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
  },
  target: {
    displayX: 640,
    displayY: 300,
    normalizedX: 0.5,
    normalizedY: 0.42,
    radiusPx: 42,
    radiusNormalized: 0.05,
    canvasWidth: 1280,
    canvasHeight: 720,
    zoneIndex: 2,
  },
  targetDelayMs: 1_200,
  t0Ms: 5_000,
  t1Ms: 5_190,
  t2Ms: 5_340,
  t3Ms: null,
  reactionTimeMs: 190,
  movementTimeMs: 150,
  totalResponseMs: 340,
  detectedHand: "right",
  handConfidence: 0.96,
  firstHandToValidHit: "right",
  requiredHand: "either",
  decisionCorrect: true,
  wrongHand: false,
  falseAttack: false,
  correctReject: false,
  decisionCompletedAtMs: 5_340,
  peakVelocityMps: 2.1,
  meanPunchVelocityMps: 1.6,
  outcome: "HIT",
  timeout: false,
  prematureMovement: false,
  trackingQualityPct: 96,
  processingFps: 30,
  qualityFlags: [],
  combo: null,
  guardReturn: null,
  defense: null,
  virtualOpponent: null,
};

describe("session JSON export", () => {
  it("exports a versioned, reproducible and media-free session record", () => {
    const session = buildSessionExport({
      sessionId: "session-1",
      label: "  Morning test  ",
      startedAt: "2026-08-18T08:00:00.000Z",
      endedAt: "2026-08-18T08:05:00.000Z",
      protocolId: "full-reaction",
      camera,
      calibration,
      estimatedPoseFps: 30,
      estimatedVideoFps: 59.7,
      audioMode: "cues",
      trials: [trial],
      summary: buildSessionSummary([trial], 30),
      environment: {
        userAgent: "Vitest",
        language: "tr-TR",
        screen: { width: 1920, height: 1080, devicePixelRatio: 1 },
      },
    });

    expect(session.schemaVersion).toBe("blackbox-fight-lab-session/0.2");
    expect(session.protocol.protocolId).toBe("full-reaction");
    expect(session.label).toBe("Morning test");
    expect(session.trials).toEqual([trial]);
    expect(session.config.snapshot.motion.onsetVelocityMps).toBeGreaterThan(0);
    expect(session.timingConvention).toContain("T0");
    // Cue'lar sesli okunmadıysa ölçüm saf görsel kalır — kayıt bunu taşımalı.
    expect(session.audio).toEqual({ mode: "cues", spokenCues: false });
    expect(JSON.stringify(session)).not.toMatch(/data:image|blob:|videoFrame/i);
  });
});
