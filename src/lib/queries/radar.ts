import "server-only";
import { prisma } from "@/lib/db";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  compareRadarPriority,
  countByBand,
  countBySignal,
  evaluateMemberRadar,
  type MemberRadar,
  type RadarBand,
  type RadarSignalKey,
} from "@/domain/analysis/member-radar";
import { summarizeCredits, type BookingStatus } from "@/domain/booking/credits";
import { summarizeDue } from "@/domain/finance/dues";
import { listWaiverBoard } from "@/lib/queries/waivers";
import type { CheckInAnswers } from "@/domain/performance/types";

/**
 * TAKİP RADARI SORGUSU — salonun tamamını (ya da bir antrenörün
 * sporcularını) tek geçişte tarar.
 *
 * Kural: **sporcu başına ayrı sorgu yok.** 100 sporcuda 101 gidiş-dönüş
 * yerine 5 toplu sorgu çekilip bellekte eşleştirilir. Ekran her açılışta
 * çalıştığı için maliyeti sabit tutmak gerekiyor.
 *
 * Kapsam: `memberWhere(scope)` — antrenör YALNIZ kendi sporcularını görür
 * (bkz. `src/lib/auth/scope.ts`). Doğrudan `organizationId` yazmak sızıntıdır.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Geriye ne kadar bakılacağı. Devamlılık ve gelme oranı için 180 gün
 * fazlasıyla yeter; daha eskisi bugünün kararını değiştirmez. Yürürlükteki
 * uzun paketler bu pencereden taşarsa alt sınır aboneliğin başlangıcına
 * çekilir (aşağıda), yoksa ders hakkı yanlış sayılırdı.
 */
const DEFAULT_WINDOW_DAYS = 180;

export type MemberRadarRow = {
  id: string;
  fullName: string;
  memberNo: string;
  status: string;
  createdAt: Date;
  /** Sorumlu antrenör — atanmamışsa `null`. */
  coachUserId: string | null;
  coachName: string | null;
  lastActivityAt: Date | null;
  lastCheckInWeek: Date | null;
  overallScore: number | null;
  /** Yürürlükteki paketin adı — listede tek satır bağlam. */
  membershipLabel: string | null;
  radar: MemberRadar;
};

export type MemberRadarBoard = {
  rows: MemberRadarRow[];
  byBand: Record<RadarBand, number>;
  /** Hangi sinyal kaç sporcuda — sistemik sorun burada görünür. */
  bySignal: { key: RadarSignalKey; count: number }[];
  /** Radarın baktığı sporcu sayısı. */
  total: number;
};

type MemberRow = {
  id: string;
  fullName: string;
  memberNo: string;
  status: string;
  createdAt: Date;
  userId: string | null;
  assignedCoachUserId: string | null;
  assignedCoach: {
    email: string;
    profile: { displayName: string } | null;
  } | null;
  checkIns: { weekStart: Date; answersJson: string }[];
  performanceSnapshots: { overallScore: number }[];
  trainingLogs: { loggedAt: Date }[];
};

type BookingRow = {
  memberId: string;
  status: string;
  slot: { startsAt: Date };
};

type SubscriptionRow = {
  id: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  sessionsTotal: number | null;
  priceMinor: number;
  plan: { name: string };
};

/** Sporcunun son gerçek aktivitesi: antrenman kaydı ya da KATILDIĞI seans. */
function lastActivityOf(
  member: MemberRow,
  bookings: BookingRow[],
): Date | null {
  const lastLog = member.trainingLogs[0]?.loggedAt ?? null;
  // Rezervasyon yapmak aktivite değildir; gelmek aktivitedir.
  const lastAttended = bookings
    .filter((row) => row.status === "katildi")
    .reduce<Date | null>(
      (latest, row) =>
        latest === null || row.slot.startsAt > latest ? row.slot.startsAt : latest,
      null,
    );

  if (lastLog === null) return lastAttended;
  if (lastAttended === null) return lastLog;
  return lastLog > lastAttended ? lastLog : lastAttended;
}

/**
 * Yürürlükteki üyelik + ders hakkı. Birden çok aktif abonelik varsa (yenileme
 * sırada bekliyorsa) **en önce biten** yürürlüktedir — `getMembershipCredits`
 * ile aynı kural, ama burada toplu veriden hesaplanır.
 */
function currentMembership(
  subscriptions: SubscriptionRow[],
  bookings: BookingRow[],
  now: Date,
) {
  const active = subscriptions
    .filter((row) => row.status === "aktif" && row.endDate >= now)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())[0];
  if (!active) return null;

  const inWindow = bookings.filter(
    (row) =>
      row.slot.startsAt >= active.startDate && row.slot.startsAt <= active.endDate,
  );
  const credits = summarizeCredits({
    total: active.sessionsTotal,
    bookingStatuses: inWindow.map((row) => row.status as BookingStatus),
  });

  return {
    planName: active.plan.name,
    snapshot: {
      daysLeft: Math.ceil((active.endDate.getTime() - now.getTime()) / MS_PER_DAY),
      remaining: credits.remaining,
      unlimited: credits.unlimited,
    },
  };
}

/** Süresi dolmuş üyeliklerden kalan tahsil edilmemiş bakiye (kuruş). */
function overdueOf(
  subscriptions: SubscriptionRow[],
  paidBySubscription: Map<string, number>,
  now: Date,
): number {
  return subscriptions.reduce((total, row) => {
    if (row.priceMinor <= 0) return total;
    const due = summarizeDue({
      priceMinor: row.priceMinor,
      paidMinor: paidBySubscription.get(row.id) ?? 0,
      endDate: row.endDate,
      now,
    });
    return due.status === "gecikti" ? total + due.balanceMinor : total;
  }, 0);
}

export type MemberRadarOptions = {
  /**
   * Hangi kayıt durumları taransın. Varsayılan yalnız `active`: aday ve
   * pasif kayıtlar için "gelmiyor" demek anlamsız olurdu.
   */
  statuses?: string[];
  now?: Date;
};

/**
 * Radar tablosu — sıralanmış hâlde döner (en acil üstte).
 *
 * Beş toplu sorgu: sporcular, rezervasyonlar, abonelikler, tahsilat
 * toplamları, onam tablosu. Onam tablosu kendi içinde iki sorgu daha
 * yapar; bayrak kapalıysa bile şablon yoksa boş döner.
 */
export async function getMemberRadarBoard(
  scope: StaffScope,
  { statuses = ["active"], now = new Date() }: MemberRadarOptions = {},
): Promise<MemberRadarBoard> {
  const members = (await prisma.member.findMany({
    where: memberWhere(scope, { status: { in: statuses } }),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      status: true,
      createdAt: true,
      userId: true,
      assignedCoachUserId: true,
      assignedCoach: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
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
  })) as MemberRow[];

  if (members.length === 0) {
    return {
      rows: [],
      byBand: { kritik: 0, izle: 0, yeni: 0, yolunda: 0 },
      bySignal: [],
      total: 0,
    };
  }

  const memberIds = members.map((member) => member.id);

  // Abonelikleri önce çekiyoruz: rezervasyon penceresinin alt sınırı
  // yürürlükteki en eski aboneliğe göre genişleyebilir (uzun paketler).
  const subscriptions = (await prisma.memberSubscription.findMany({
    where: { memberId: { in: memberIds } },
    select: {
      id: true,
      memberId: true,
      startDate: true,
      endDate: true,
      status: true,
      sessionsTotal: true,
      priceMinor: true,
      plan: { select: { name: true } },
    },
  })) as SubscriptionRow[];

  const defaultCutoff = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * MS_PER_DAY);
  const activeStarts = subscriptions
    .filter((row) => row.status === "aktif" && row.endDate >= now)
    .map((row) => row.startDate.getTime());
  const bookingCutoff =
    activeStarts.length === 0
      ? defaultCutoff
      : new Date(Math.min(defaultCutoff.getTime(), ...activeStarts));

  const [bookings, paymentRows, waiverBoard] = await Promise.all([
    prisma.slotBooking.findMany({
      where: {
        memberId: { in: memberIds },
        slot: { startsAt: { gte: bookingCutoff } },
      },
      select: {
        memberId: true,
        status: true,
        slot: { select: { startsAt: true } },
      },
    }) as Promise<BookingRow[]>,
    prisma.payment.groupBy({
      by: ["subscriptionId"],
      where: {
        organizationId: scope.organizationId,
        subscriptionId: { not: null },
        memberId: { in: memberIds },
      },
      _sum: { amountMinor: true },
    }),
    listWaiverBoard(scope),
  ]);

  const bookingsByMember = new Map<string, BookingRow[]>();
  for (const row of bookings) {
    const list = bookingsByMember.get(row.memberId);
    if (list) list.push(row);
    else bookingsByMember.set(row.memberId, [row]);
  }

  const subscriptionsByMember = new Map<string, SubscriptionRow[]>();
  for (const row of subscriptions) {
    const list = subscriptionsByMember.get(row.memberId);
    if (list) list.push(row);
    else subscriptionsByMember.set(row.memberId, [row]);
  }

  const paidBySubscription = new Map(
    paymentRows
      .filter((row): row is typeof row & { subscriptionId: string } =>
        Boolean(row.subscriptionId),
      )
      .map((row) => [row.subscriptionId, row._sum.amountMinor ?? 0]),
  );

  const pendingWaiversByMember = new Map(
    waiverBoard.map((row) => [row.memberId, row.pendingCount]),
  );

  const rows: MemberRadarRow[] = members.map((member) => {
    const own = bookingsByMember.get(member.id) ?? [];
    const ownSubscriptions = subscriptionsByMember.get(member.id) ?? [];

    const settled = own.filter(
      (row) => row.status === "katildi" || row.status === "gelmedi",
    );
    const noShow = settled.filter((row) => row.status === "gelmedi");

    const lastCheckIn = member.checkIns[0] ?? null;
    const answers = lastCheckIn
      ? (JSON.parse(lastCheckIn.answersJson) as CheckInAnswers)
      : null;

    const membership = currentMembership(ownSubscriptions, own, now);
    const lastActivityAt = lastActivityOf(member, own);

    const radar = evaluateMemberRadar({
      now,
      memberSince: member.createdAt,
      lastActivityAt,
      lastCheckInWeek: lastCheckIn?.weekStart ?? null,
      overallScore: member.performanceSnapshots[0]?.overallScore ?? null,
      sorenessFlag: answers?.sorenessFlag ?? false,
      settledBookings: settled.length,
      noShowCount: noShow.length,
      membership: membership?.snapshot ?? null,
      overdueMinor: overdueOf(ownSubscriptions, paidBySubscription, now),
      pendingWaivers: pendingWaiversByMember.get(member.id) ?? 0,
      hasAccount: member.userId !== null,
      hasCoach: member.assignedCoachUserId !== null,
    });

    return {
      id: member.id,
      fullName: member.fullName,
      memberNo: member.memberNo,
      status: member.status,
      createdAt: member.createdAt,
      coachUserId: member.assignedCoachUserId,
      coachName:
        member.assignedCoach?.profile?.displayName ??
        member.assignedCoach?.email ??
        null,
      lastActivityAt,
      lastCheckInWeek: lastCheckIn?.weekStart ?? null,
      overallScore: member.performanceSnapshots[0]?.overallScore ?? null,
      membershipLabel: membership?.planName ?? null,
      radar,
    };
  });

  rows.sort((a, b) => compareRadarPriority(a.radar, b.radar));

  return {
    rows,
    byBand: countByBand(rows.map((row) => row.radar)),
    bySignal: countBySignal(rows.map((row) => row.radar)),
    total: rows.length,
  };
}

/**
 * Yönetici genel bakışı ve koç karnesi için hafif özet — satırların
 * tamamını taşımadan yalnız bant sayıları.
 */
export type RadarCoachSummary = {
  coachUserId: string | null;
  critical: number;
  watch: number;
  quiet: number;
  total: number;
};

/** Radar satırlarını sorumlu antrenöre göre gruplar. */
export function groupRadarByCoach(
  rows: readonly MemberRadarRow[],
  { quietDays = 14 }: { quietDays?: number } = {},
): Map<string | null, RadarCoachSummary> {
  const groups = new Map<string | null, RadarCoachSummary>();

  for (const row of rows) {
    const key = row.coachUserId;
    const current = groups.get(key) ?? {
      coachUserId: key,
      critical: 0,
      watch: 0,
      quiet: 0,
      total: 0,
    };

    current.total += 1;
    if (row.radar.band === "kritik") current.critical += 1;
    if (row.radar.band === "izle") current.watch += 1;
    // Hiç kaydı olmayan sporcu da "sessiz" sayılır — hiç gelmemek de
    // gelmemektir.
    if (row.radar.daysQuiet === null || row.radar.daysQuiet >= quietDays) {
      current.quiet += 1;
    }

    groups.set(key, current);
  }

  return groups;
}
