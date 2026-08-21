import { median, roundMetric } from "../statistics";
import type { FatigueComparison } from "./advancedEngines";
import type { WrestlingProtocolId, WrestlingSession, WrestlingSessionSummary } from "./protocolTypes";

export type WrestlingTrend = {
  protocolId: WrestlingProtocolId;
  protocolVersion: string;
  configHash: string;
  sessionCount: number;
  baseline: number | null;
  latest: number | null;
  personalBest: number | null;
  last3Median: number | null;
  last5Median: number | null;
  changeFromBaseline: number | null;
  changeFromBaselinePct: number | null;
  latestQualityPct: number | null;
};

export type WrestlingProfileDimension = {
  id: "reaction" | "shotRecognition" | "defense" | "movement" | "recovery" | "consistency" | "fatigueResilience" | "decision";
  label: string;
  score: number | null;
  rawMetric: string;
  note: "Experimental product score; not a scientifically validated rating.";
};

export type AdaptiveRecommendation = {
  ruleId: string;
  title: string;
  reason: string;
  protocolId: WrestlingProtocolId;
  priority: "high" | "medium";
};

const compatible = (sessions: readonly WrestlingSession[], latest: WrestlingSession): WrestlingSession[] =>
  sessions.filter((session) => session.protocolId === latest.protocolId && session.protocolVersion === latest.protocolVersion && session.configHash === latest.configHash);

export function buildProtocolTrend(sessions: readonly WrestlingSession[], protocolId: WrestlingProtocolId): WrestlingTrend | null {
  const protocolSessions = sessions.filter((session) => session.protocolId === protocolId).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
  const latest = protocolSessions.at(-1);
  if (!latest) return null;
  const comparable = compatible(protocolSessions, latest);
  const values = comparable.map((session) => session.summary.medianReactionTimeMs).filter((value): value is number => value !== null);
  const baseline = values[0] ?? null;
  const current = values.at(-1) ?? null;
  const change = baseline === null || current === null ? null : current - baseline;
  return {
    protocolId,
    protocolVersion: latest.protocolVersion,
    configHash: latest.configHash,
    sessionCount: comparable.length,
    baseline,
    latest: current,
    personalBest: values.length ? Math.min(...values) : null,
    last3Median: median(values.slice(-3)),
    last5Median: median(values.slice(-5)),
    changeFromBaseline: roundMetric(change),
    changeFromBaselinePct: roundMetric(change !== null && baseline ? (change / baseline) * 100 : null),
    latestQualityPct: latest.summary.trackingQualityPct,
  };
}

const personalScore = (current: number | null, baseline: number | null, lowerIsBetter: boolean): number | null => {
  if (current === null || baseline === null || baseline === 0) return null;
  const improvement = ((baseline - current) / Math.abs(baseline)) * (lowerIsBetter ? 1 : -1);
  return roundMetric(Math.max(0, Math.min(100, 50 + improvement * 200)));
};

const latestFor = (sessions: readonly WrestlingSession[], id: WrestlingProtocolId): WrestlingSession | null =>
  sessions.filter((session) => session.protocolId === id).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt)).at(-1) ?? null;

export function buildWrestlingProfile(sessions: readonly WrestlingSession[], fatigue?: FatigueComparison): WrestlingProfileDimension[] {
  const trend = (id: WrestlingProtocolId) => buildProtocolTrend(sessions, id);
  const shot = trend("shot-reaction");
  const recognition = latestFor(sessions, "fake-real-recognition");
  const sprawl = trend("sprawl-reaction");
  const movement = trend("movement-lab");
  const stance = latestFor(sessions, "stance-consistency");
  const choice = latestFor(sessions, "wrestling-choice");
  const recoveryLatest = latestFor(sessions, "sprawl-reaction")?.summary.medianRecoveryToStanceMs ?? null;
  const recoveryBaseline = sessions.find((session) => session.protocolId === "sprawl-reaction")?.summary.medianRecoveryToStanceMs ?? null;
  const note = "Experimental product score; not a scientifically validated rating." as const;
  return [
    { id: "reaction", label: "Reaction", score: personalScore(shot?.latest ?? null, shot?.baseline ?? null, true), rawMetric: `${shot?.latest ?? "—"} ms`, note },
    { id: "shotRecognition", label: "Shot Recognition", score: recognition ? roundMetric(recognition.summary.accuracyPct) : null, rawMetric: `${recognition?.summary.accuracyPct ?? "—"}% accuracy`, note },
    { id: "defense", label: "Defense", score: personalScore(sprawl?.latest ?? null, sprawl?.baseline ?? null, true), rawMetric: `${sprawl?.latest ?? "—"} ms sprawl reaction`, note },
    { id: "movement", label: "Movement", score: personalScore(movement?.latest ?? null, movement?.baseline ?? null, true), rawMetric: `${movement?.latest ?? "—"} ms`, note },
    { id: "recovery", label: "Recovery", score: personalScore(recoveryLatest, recoveryBaseline, true), rawMetric: `${recoveryLatest ?? "—"} ms to stance`, note },
    { id: "consistency", label: "Consistency", score: stance?.summary.stanceConsistencyPct ?? null, rawMetric: `${stance?.summary.stanceConsistencyPct ?? "—"}% stance consistency`, note },
    { id: "fatigueResilience", label: "Fatigue Resilience", score: fatigue?.reactionChangePct === null || fatigue?.reactionChangePct === undefined ? null : roundMetric(Math.max(0, Math.min(100, 50 - fatigue.reactionChangePct * 2))), rawMetric: `${fatigue?.reactionChangePct ?? "—"}% reaction change`, note },
    { id: "decision", label: "Decision", score: choice?.summary.accuracyPct ?? null, rawMetric: `${choice?.summary.accuracyPct ?? "—"}% accuracy`, note },
  ];
}

export function buildAdaptiveRecommendations(input: { sessions: readonly WrestlingSession[]; fatigue?: FatigueComparison }): AdaptiveRecommendation[] {
  const latestSessions = input.sessions.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt));
  const usable = latestSessions.filter((session) => session.summary.trackingQualityPct >= 60);
  const recommendations: AdaptiveRecommendation[] = [];
  const shot = usable.find((session) => session.protocolId === "shot-reaction");
  if (shot?.summary.leftMedianMs !== null && shot?.summary.rightMedianMs !== null && shot?.summary.leftMedianMs !== undefined && shot?.summary.rightMedianMs !== undefined) {
    const average = (shot.summary.leftMedianMs + shot.summary.rightMedianMs) / 2;
    if (average > 0 && (shot.summary.leftMedianMs - shot.summary.rightMedianMs) / average > 0.12) recommendations.push({ ruleId: "weak-left-defense", title: "Left Shot Defense Drill", reason: "Sol cue medianı, aynı sürümdeki sağ cue medianından belirgin biçimde daha yavaş.", protocolId: "shot-reaction", priority: "high" });
  }
  const recognition = usable.find((session) => session.protocolId === "fake-real-recognition");
  if ((recognition?.summary.falseDefenseRatePct ?? 0) > 20) recommendations.push({ ruleId: "high-fake-response", title: "Fake / Real Recognition", reason: "Son uyumlu seansta false defense oranı kişisel hedef bandının üzerinde.", protocolId: "fake-real-recognition", priority: "high" });
  const sprawl = usable.find((session) => session.protocolId === "sprawl-reaction");
  const sprawlTrend = buildProtocolTrend(usable, "sprawl-reaction");
  if (sprawl && sprawlTrend && sprawl.summary.medianRecoveryToStanceMs !== null && sprawlTrend.sessionCount >= 2) {
    const olderRecovery = usable.filter((session) => session.protocolId === "sprawl-reaction" && session.protocolVersion === sprawl.protocolVersion && session.configHash === sprawl.configHash).at(-1)?.summary.medianRecoveryToStanceMs ?? null;
    if (olderRecovery && sprawl.summary.medianRecoveryToStanceMs > olderRecovery * 1.12) recommendations.push({ ruleId: "slow-recovery", title: "Recovery To Stance Drill", reason: "Stable stance recovery, uyumlu kişisel referanstan daha yavaş.", protocolId: "sprawl-reaction", priority: "medium" });
  }
  if ((input.fatigue?.reactionChangePct ?? 0) > 12) recommendations.push({ ruleId: "fatigue-deterioration", title: "Wrestling Fatigue Response Drill", reason: "Post-work reaction, kişisel baseline'a göre kötüleşti; bu bir recovery tanısı değildir.", protocolId: "wrestling-fatigue", priority: "medium" });
  return recommendations;
}

export const summaryValue = (summary: WrestlingSessionSummary, key: keyof WrestlingSessionSummary): number | null => {
  const value = summary[key];
  return typeof value === "number" ? value : null;
};
