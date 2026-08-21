import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getWeekStart, getWeekStartInstant } from "@/lib/date";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import { getBadgeKeys, getPointsTotal } from "@/lib/queries/performance";
import type { CheckInAnswers } from "@/domain/performance/types";

/**
 * Antrenör sorguları — hepsi `StaffScope` alır, çünkü antrenör **yalnız
 * kendi sporcularını** görür (bkz. `src/lib/auth/scope.ts`). Yönetici
 * çağırdığında kapsam salonun tamamıdır. Doğrudan `where: { organizationId }`
 * yazmak sızıntıdır; `memberWhere(scope)` kullan.
 */

/** Menü rozetinde ve genel bakışta gösterilen "incelenmemiş check-in" sayısı. */
export async function countPendingCheckIns(scope: StaffScope): Promise<number> {
  return prisma.checkIn.count({
    where: { status: "submitted", member: memberWhere(scope) },
  });
}

export type PendingCheckIn = {
  id: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  weekStart: Date;
  answers: CheckInAnswers;
};

/** İncelenmeyi bekleyen check-in'ler — en yeni hafta başta. */
export async function listPendingCheckIns(
  scope: StaffScope,
  limit = 30,
): Promise<PendingCheckIn[]> {
  const rows = await prisma.checkIn.findMany({
    where: { status: "submitted", member: memberWhere(scope) },
    orderBy: { weekStart: "desc" },
    take: limit,
    include: { member: { select: { id: true, fullName: true, memberNo: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    memberId: row.member.id,
    memberNo: row.member.memberNo,
    memberName: row.member.fullName,
    weekStart: row.weekStart,
    answers: JSON.parse(row.answersJson) as CheckInAnswers,
  }));
}

export type StaffOverview = {
  totalMembers: number;
  activeMembers: number;
  pendingCheckIns: number;
  checkInsThisWeek: number;
  trainingLogsThisWeek: number;
  pendingPreview: PendingCheckIn[];
};

/** Personel panelinin giriş ekranı için tek seferde toplanan sayılar. */
export async function getStaffOverview(
  scope: StaffScope,
): Promise<StaffOverview> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekStartedAt = getWeekStartInstant(now);

  const [
    totalMembers,
    activeMembers,
    pendingCheckIns,
    checkInsThisWeek,
    trainingLogsThisWeek,
    pendingPreview,
  ] = await Promise.all([
    prisma.member.count({ where: memberWhere(scope) }),
    prisma.member.count({ where: memberWhere(scope, { status: "active" }) }),
    countPendingCheckIns(scope),
    prisma.checkIn.count({
      where: { weekStart, member: memberWhere(scope) },
    }),
    prisma.trainingLog.count({
      where: { loggedAt: { gte: weekStartedAt }, member: memberWhere(scope) },
    }),
    listPendingCheckIns(scope, 5),
  ]);

  return {
    totalMembers,
    activeMembers,
    pendingCheckIns,
    checkInsThisWeek,
    trainingLogsThisWeek,
    pendingPreview,
  };
}

/** Aday kayıtları — henüz üye olmamış, deneme dersi aşamasındakiler. */
export async function listLeads(scope: StaffScope) {
  return prisma.member.findMany({
    where: memberWhere(scope, { status: "lead" }),
    orderBy: { createdAt: "desc" },
  });
}

export type MembershipRow = {
  id: string;
  fullName: string;
  memberNo: string;
  status: string;
  createdAt: Date;
  lastTrainingAt: Date | null;
  /** Sorumlu antrenör — atanmamışsa `null` (yalnız yönetici görür). */
  coachUserId: string | null;
  coachName: string | null;
};

export type MembershipBreakdown = {
  total: number;
  byStatus: { status: string; count: number }[];
  members: MembershipRow[];
  /** Aktif görünen ama `dormantDays` gündür antrenman kaydı olmayanlar. */
  dormant: MembershipRow[];
};

/** Üyelik durumu dökümü — ödeme/plan modeli gelene kadar `Member.status` üzerinden. */
export async function getMembershipBreakdown(
  scope: StaffScope,
  { dormantDays = 30 }: { dormantDays?: number } = {},
): Promise<MembershipBreakdown> {
  const rows = await prisma.member.findMany({
    where: memberWhere(scope),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      status: true,
      createdAt: true,
      assignedCoachUserId: true,
      assignedCoach: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
      trainingLogs: {
        orderBy: { loggedAt: "desc" },
        take: 1,
        select: { loggedAt: true },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const members: MembershipRow[] = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    memberNo: row.memberNo,
    status: row.status,
    createdAt: row.createdAt,
    lastTrainingAt: row.trainingLogs[0]?.loggedAt ?? null,
    coachUserId: row.assignedCoachUserId,
    coachName:
      row.assignedCoach?.profile?.displayName ??
      row.assignedCoach?.email ??
      null,
  }));

  const dormantBefore = new Date(Date.now() - dormantDays * 24 * 60 * 60 * 1000);

  return {
    total: rows.length,
    byStatus: [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    members,
    dormant: members.filter(
      (member) =>
        member.status === "active" &&
        (!member.lastTrainingAt || member.lastTrainingAt < dormantBefore),
    ),
  };
}

export type MemberInsight = {
  id: string;
  fullName: string;
  memberNo: string;
  overallScore: number | null;
  lastCheckInWeek: Date | null;
  lastTrainingAt: Date | null;
  sorenessFlag: boolean;
  /** Aksiyon gerektiren durumlar — antrenörün "kim düşüyor" sorusu. */
  flags: ("check-in-yok" | "antrenman-yok" | "agri" | "skor-dusuk")[];
};

/**
 * "Kim düşüyor" ekranı — Kong'un koç içgörülerinin sadeleştirilmiş hâli.
 * Tek sorguda üye + son check-in + son antrenman çekilir (N+1 yok).
 */
export async function getMemberInsights(
  scope: StaffScope,
  { inactiveDays = 14 }: { inactiveDays?: number } = {},
): Promise<MemberInsight[]> {
  const rows = await prisma.member.findMany({
    where: memberWhere(scope, { status: "active" }),
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      checkIns: {
        orderBy: { weekStart: "desc" },
        take: 1,
        select: { weekStart: true, answersJson: true },
      },
      performanceSnapshots: {
        orderBy: { computedAt: "desc" },
        take: 1,
        select: { overallScore: true },
      },
      trainingLogs: {
        orderBy: { loggedAt: "desc" },
        take: 1,
        select: { loggedAt: true },
      },
    },
  });

  const thisWeek = getWeekStart(new Date());
  const inactiveBefore = new Date(
    Date.now() - inactiveDays * 24 * 60 * 60 * 1000,
  );

  return rows
    .map((row) => {
      const lastCheckIn = row.checkIns[0] ?? null;
      const answers = lastCheckIn
        ? (JSON.parse(lastCheckIn.answersJson) as CheckInAnswers)
        : null;
      const lastTrainingAt = row.trainingLogs[0]?.loggedAt ?? null;
      const overallScore = row.performanceSnapshots[0]?.overallScore ?? null;

      const flags: MemberInsight["flags"] = [];
      if (!lastCheckIn || lastCheckIn.weekStart < thisWeek) {
        flags.push("check-in-yok");
      }
      if (!lastTrainingAt || lastTrainingAt < inactiveBefore) {
        flags.push("antrenman-yok");
      }
      if (answers?.sorenessFlag) flags.push("agri");
      if (overallScore !== null && overallScore < 50) flags.push("skor-dusuk");

      return {
        id: row.id,
        fullName: row.fullName,
        memberNo: row.memberNo,
        overallScore,
        lastCheckInWeek: lastCheckIn?.weekStart ?? null,
        lastTrainingAt,
        sorenessFlag: answers?.sorenessFlag ?? false,
        flags,
      };
    })
    .sort((a, b) => b.flags.length - a.flags.length);
}

/** Üye listesi + toplam puan. Puanlar tek `groupBy` ile gelir — üye başına
 * ayrı sorgu (N+1) 100 üyede 101 gidiş-dönüş demekti. */
export async function listMembers(scope: StaffScope) {
  const members = await prisma.member.findMany({
    where: memberWhere(scope),
    orderBy: { createdAt: "desc" },
    include: {
      assignedCoach: {
        select: { id: true, email: true, profile: { select: { displayName: true } } },
      },
    },
  });
  if (members.length === 0) return [];

  const pointRows = await prisma.pointEvent.groupBy({
    by: ["memberId"],
    where: { memberId: { in: members.map((member) => member.id) } },
    _sum: { points: true },
  });

  const pointsByMember = new Map(
    pointRows.map((row) => [row.memberId, row._sum.points ?? 0]),
  );

  return members.map(({ assignedCoach, ...member }) => ({
    ...member,
    points: pointsByMember.get(member.id) ?? 0,
    /** Sorumlu antrenörün görünen adı — atanmamışsa `null`. */
    coachName:
      assignedCoach?.profile?.displayName ?? assignedCoach?.email ?? null,
  }));
}

export type CreateMemberInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  /** Sorumlu antrenör — genelde sporcuyu ekleyen kişinin kendisi. */
  assignedCoachUserId?: string | null;
};

export type CreateMemberResult =
  | { ok: true; memberId: string }
  | { ok: false; error: string };

export async function createMemberWithAccount(
  organizationId: string,
  input: CreateMemberInput,
): Promise<CreateMemberResult> {
  const normalizedEmail = input.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    return { ok: false, error: "Bu e-posta zaten kayıtlı." };
  }

  const memberCount = await prisma.member.count({ where: { organizationId } });
  const memberNo = `BB-${String(memberCount + 1).padStart(4, "0")}`;
  const passwordHash = await hashPassword(input.password);

  const member = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        profile: { create: { displayName: input.fullName } },
      },
    });

    await tx.organizationUser.create({
      data: { organizationId, userId: user.id, role: "member", status: "active" },
    });

    return tx.member.create({
      data: {
        organizationId,
        userId: user.id,
        memberNo,
        fullName: input.fullName,
        email: normalizedEmail,
        phone: input.phone,
        status: "active",
        assignedCoachUserId: input.assignedCoachUserId ?? null,
      },
    });
  });

  return { ok: true, memberId: member.id };
}

export async function getMemberDetail(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const [checkIns, trainingLogs, points, badgeKeys] = await Promise.all([
    prisma.checkIn.findMany({
      where: { memberId },
      orderBy: { weekStart: "desc" },
      take: 12,
    }),
    prisma.trainingLog.findMany({
      where: { memberId },
      orderBy: { loggedAt: "desc" },
      take: 20,
    }),
    getPointsTotal(memberId),
    getBadgeKeys(memberId),
  ]);

  return { member, checkIns, trainingLogs, points, badgeKeys };
}

export async function reviewCheckIn(
  checkInId: string,
  reviewedByUserId: string,
): Promise<void> {
  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { status: "reviewed", reviewedAt: new Date(), reviewedByUserId },
  });
}
