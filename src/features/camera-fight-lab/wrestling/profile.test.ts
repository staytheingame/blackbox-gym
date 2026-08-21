import { describe, expect, it } from "vitest";
import { buildAdaptiveRecommendations, buildProtocolTrend, buildWrestlingProfile } from "./profile";
import type { WrestlingSession, WrestlingSessionSummary } from "./protocolTypes";

const summary = (reaction: number, left = reaction, right = reaction, tracking = 95): WrestlingSessionSummary => ({
  trialCount: 10, validTrialCount: 10, correctCount: 9, accuracyPct: 90,
  medianReactionTimeMs: reaction, medianExecutionTimeMs: 150, medianTotalResponseMs: reaction + 150,
  medianRecoveryToStanceMs: 400, reactionConsistencyMadMs: 20, movementConsistencyMad: 0.01,
  stanceConsistencyPct: 85, falseDefenseRatePct: 10, leftMedianMs: left, rightMedianMs: right,
  absoluteDifferenceMs: Math.abs(left - right), relativeDifferencePct: 0, trackingQualityPct: tracking, qualityFlags: [],
});

const session = (id: string, reaction: number, version = "1.0.0", hash = "same", left = reaction, right = reaction, tracking = 95): WrestlingSession => ({
  schemaVersion: "blackbox-wrestling-lab-session/1.0", sport: "wrestling", sessionId: id, athleteId: "athlete",
  label: null, startedAt: `2026-08-${id.padStart(2, "0")}T10:00:00.000Z`, endedAt: `2026-08-${id.padStart(2, "0")}T10:05:00.000Z`,
  protocolId: "shot-reaction", protocolVersion: version, configHash: hash,
  cameraMetadata: { deviceLabel: "Test", width: 1280, height: 720, frameRate: 30 },
  calibrationSnapshot: {} as WrestlingSession["calibrationSnapshot"], configSnapshot: {}, rawTrials: [], summary: summary(reaction, left, right, tracking), qualityFlags: [],
});

describe("W15 longitudinal wrestling profile", () => {
  it("compares only compatible protocol versions and hashes", () => {
    const trend = buildProtocolTrend([session("1", 420), session("2", 390), session("3", 200, "2.0.0", "new")], "shot-reaction");
    expect(trend?.sessionCount).toBe(1);
    expect(trend?.baseline).toBe(200);
    expect(trend?.latest).toBe(200);
  });

  it("reports baseline/latest/personal best and robust recent medians", () => {
    const trend = buildProtocolTrend([session("1", 420), session("2", 390), session("3", 360)], "shot-reaction");
    expect(trend).toMatchObject({ baseline: 420, latest: 360, personalBest: 360, last3Median: 390 });
    expect(trend?.changeFromBaselinePct).toBeCloseTo(-14.3);
  });

  it("keeps raw metrics beside bounded experimental product scores", () => {
    const profile = buildWrestlingProfile([session("1", 420), session("2", 360)]);
    const reaction = profile.find((dimension) => dimension.id === "reaction")!;
    expect(reaction.rawMetric).toContain("360");
    expect(reaction.score).toBeGreaterThan(50);
    expect(reaction.note).toContain("not a scientifically validated rating");
  });

  it("ignores poor-quality sessions in adaptive recommendations", () => {
    expect(buildAdaptiveRecommendations({ sessions: [session("1", 400, "1.0.0", "same", 520, 300, 40)] })).toEqual([]);
    const recommendations = buildAdaptiveRecommendations({ sessions: [session("1", 400, "1.0.0", "same", 520, 300, 95)] });
    expect(recommendations.map((item) => item.ruleId)).toContain("weak-left-defense");
  });
});
