import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/date";
import { computeMemberScorecard } from "@/domain/performance/scorecard";
import type { CheckInAnswers, CheckInRecord } from "@/domain/performance/types";
import {
  pointsForCheckIn,
  pointsForTrainingLog,
  pointsForTrainingRevert,
} from "@/domain/gamification/points";
import { evaluateNewBadges, type BadgeKey } from "@/domain/gamification/badges";

export async function getCheckInHistory(memberId: string): Promise<CheckInRecord[]> {
  const rows = await prisma.checkIn.findMany({
    where: { memberId },
    orderBy: { weekStart: "asc" },
  });
  return rows.map((row) => ({
    weekStart: row.weekStart.toISOString().slice(0, 10),
    answers: JSON.parse(row.answersJson) as CheckInAnswers,
  }));
}

export async function getMemberScorecard(memberId: string) {
  const history = await getCheckInHistory(memberId);
  return computeMemberScorecard(history);
}

/** En son check-in'den geriye doğru, aralıksız haftalık seriyi sayar. */
export function countConsecutiveWeeks(history: CheckInRecord[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  let streak = 1;
  let cursor = new Date(sorted[0].weekStart + "T00:00:00.000Z");

  for (let i = 1; i < sorted.length; i++) {
    const expectedPrev = new Date(cursor);
    expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 7);
    const current = new Date(sorted[i].weekStart + "T00:00:00.000Z");
    if (current.getTime() === expectedPrev.getTime()) {
      streak += 1;
      cursor = current;
    } else {
      break;
    }
  }
  return streak;
}

export async function getPointsTotal(memberId: string): Promise<number> {
  const result = await prisma.pointEvent.aggregate({
    where: { memberId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

/** Performans kartı geçmişi — gelişim grafiğinin kaynağı. */
export async function getScoreHistory(memberId: string, limit = 24) {
  const rows = await prisma.performanceSnapshot.findMany({
    where: { memberId },
    orderBy: { computedAt: "desc" },
    take: limit,
    select: { computedAt: true, overallScore: true },
  });
  return rows.reverse();
}

export async function getBadgeKeys(memberId: string): Promise<BadgeKey[]> {
  const rows = await prisma.memberBadge.findMany({ where: { memberId } });
  return rows.map((row) => row.badgeKey as BadgeKey);
}

async function awardBadges(memberId: string, keys: BadgeKey[]) {
  if (keys.length === 0) return;
  await prisma.memberBadge.createMany({
    data: keys.map((badgeKey) => ({ memberId, badgeKey })),
  });
}

export type SubmitCheckInResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitCheckIn(
  memberId: string,
  answers: CheckInAnswers,
): Promise<SubmitCheckInResult> {
  const weekStart = getWeekStart(new Date());

  const existing = await prisma.checkIn.findUnique({
    where: { memberId_weekStart: { memberId, weekStart } },
  });
  if (existing) {
    return { ok: false, error: "Bu hafta için zaten check-in gönderdin." };
  }

  await prisma.checkIn.create({
    data: { memberId, weekStart, answersJson: JSON.stringify(answers) },
  });

  const history = await getCheckInHistory(memberId);
  const scorecard = computeMemberScorecard(history);
  const consecutiveWeeks = countConsecutiveWeeks(history);

  await prisma.performanceSnapshot.create({
    data: {
      memberId,
      scoresJson: JSON.stringify(scorecard),
      overallScore: scorecard.overallScore,
    },
  });

  const pointEvents = pointsForCheckIn({
    consecutiveWeeks,
    overallScore: scorecard.overallScore,
  });
  await prisma.pointEvent.createMany({
    data: pointEvents.map((event) => ({
      memberId,
      action: event.action,
      points: event.points,
    })),
  });

  const [totalCheckIns, totalTrainingLogs, alreadyAwarded] = await Promise.all([
    prisma.checkIn.count({ where: { memberId } }),
    prisma.trainingLog.count({ where: { memberId } }),
    getBadgeKeys(memberId),
  ]);

  const newBadges = evaluateNewBadges({
    totalCheckIns,
    consecutiveWeeks,
    totalTrainingLogs,
    latestOverallScore: scorecard.overallScore,
    alreadyAwarded,
  });
  await awardBadges(memberId, newBadges);

  return { ok: true };
}

export type TrainingLogInput = {
  type: string;
  durationMinutes: number;
  rounds?: number;
  intensity: number;
  notes?: string;
};

export async function getTrainingLogs(memberId: string) {
  return prisma.trainingLog.findMany({
    where: { memberId },
    orderBy: { loggedAt: "desc" },
    take: 50,
  });
}

/** Antrenman kaydı + puan + rozet. Oluşan kaydın id'sini döner (program
 * günü tamamlamada `PlanCompletion.trainingLogId`'ye bağlanır). */
export async function logTraining(
  memberId: string,
  input: TrainingLogInput,
  createdByUserId: string,
): Promise<string> {
  const log = await prisma.trainingLog.create({
    data: {
      memberId,
      type: input.type,
      durationMinutes: input.durationMinutes,
      rounds: input.rounds,
      intensity: input.intensity,
      notes: input.notes,
      createdByUserId,
    },
  });

  const pointEvents = pointsForTrainingLog();
  await prisma.pointEvent.createMany({
    data: pointEvents.map((event) => ({
      memberId,
      action: event.action,
      points: event.points,
    })),
  });

  const [totalTrainingLogs, totalCheckIns, alreadyAwarded, history] =
    await Promise.all([
      prisma.trainingLog.count({ where: { memberId } }),
      prisma.checkIn.count({ where: { memberId } }),
      getBadgeKeys(memberId),
      getCheckInHistory(memberId),
    ]);

  const scorecard = computeMemberScorecard(history);
  const newBadges = evaluateNewBadges({
    totalCheckIns,
    consecutiveWeeks: countConsecutiveWeeks(history),
    totalTrainingLogs,
    latestOverallScore: scorecard.overallScore,
    alreadyAwarded,
  });
  await awardBadges(memberId, newBadges);

  return log.id;
}

/**
 * Otomatik oluşmuş bir antrenman kaydını geri alır (program günü işareti
 * kaldırıldığında). Kayıt silinir, puan ters kayıtla iade edilir.
 * Kazanılmış rozetler geri alınmaz — bilinçli: rozet bir kere hak edilir.
 */
export async function revertTrainingLog(
  memberId: string,
  trainingLogId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.trainingLog.deleteMany({
      where: { id: trainingLogId, memberId },
    });
    if (deleted.count === 0) return;

    await tx.pointEvent.createMany({
      data: pointsForTrainingRevert().map((event) => ({
        memberId,
        action: event.action,
        points: event.points,
      })),
    });
  });
}

export type LeaderboardEntry = {
  memberId: string;
  fullName: string;
  points: number;
  badgeCount: number;
};

export async function getLeaderboard(
  organizationId: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const members = await prisma.member.findMany({
    where: { organizationId, status: "active" },
    select: {
      id: true,
      fullName: true,
      pointEvents: { select: { points: true } },
      badges: { select: { id: true } },
    },
  });

  return members
    .map((member) => ({
      memberId: member.id,
      fullName: member.fullName,
      points: member.pointEvents.reduce((sum, e) => sum + e.points, 0),
      badgeCount: member.badges.length,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
