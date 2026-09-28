import "server-only";
import { prisma } from "@/lib/db";
import { slotWhere, type StaffScope } from "@/lib/auth/scope";
import { gymDateTimeToInstant, toGymDateKey } from "@/lib/date";
import { summarizeCredits, type BookingStatus } from "@/domain/booking/credits";

/**
 * GÜNÜN AKIŞI — antrenörün sabah açtığı ekran.
 *
 * Soru şu: "bugün kim geliyor, kim hesabını kurmadı, kimin paketi bitiyor,
 * hangi seansın yoklaması alınmadı." Hepsi tek sayfada ve tek turda gelir;
 * antrenör ders arasında telefondan bakıyor, sayfa gezmesin.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DayRosterMember = {
  bookingId: string;
  memberId: string;
  fullName: string;
  memberNo: string;
  phone: string | null;
  status: BookingStatus;
  /** Hesabını kurmamış sporcuya bildirim gitmez — antrenör elle arar. */
  hasAccount: boolean;
  remindersEnabled: boolean;
  /** Yürürlükte aktif paketi var mı. `false` = paket yok (ders alamaz). */
  hasPackage: boolean;
  /** Yürürlükteki paketten kalan ders (`null` = sınırsız ya da paket yok). */
  sessionsRemaining: number | null;
  membershipDaysLeft: number | null;
};

export type DaySlot = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  kind: string;
  title: string | null;
  notes: string | null;
  status: string;
  /** Yeri tutulmuş sporcular. */
  roster: DayRosterMember[];
  /** Onay bekleyen grup katılım istekleri. */
  pending: DayRosterMember[];
  emptySeats: number;
  /** Başlangıcı geçmiş ama yoklaması alınmamış. */
  needsAttendance: boolean;
  /** Şu an devam ediyor. */
  inProgress: boolean;
  past: boolean;
};

export type DayView = {
  dateKey: string;
  slots: DaySlot[];
  totalSeats: number;
  totalCapacity: number;
  attendancePending: number;
  /** Bugün dersi olup hesabı kurulmamış sporcu sayısı. */
  withoutAccount: number;
};

const SEAT_STATUSES = ["onayli", "katildi", "gelmedi"];

/**
 * Salon saatiyle bir günün seansları ve katılımcıları.
 * `dateKey` verilmezse bugün.
 *
 * KAPSAM: antrenör YALNIZ kendi açtığı seansları görür (`slotWhere`), yönetici
 * salonun tamamını. Burası daha önce düz `organizationId` ile sorguluyordu;
 * iki antrenörlü bir salonda herkes ötekinin gününü görüyor ve — daha kötüsü —
 * başkasının sporcusunun yoklamasını alabiliyordu. Ders saatleri sporcu
 * kapsamından ayrı bir eksendir; ayrımın gerekçesi `scope.ts` içinde.
 */
export async function getDayView(
  scope: StaffScope,
  dateKey?: string,
): Promise<DayView> {
  const now = new Date();
  const key = dateKey ?? toGymDateKey(now);
  const from = gymDateTimeToInstant(key, "00:00");
  const to = new Date(from.getTime() + MS_PER_DAY);

  const slots = await prisma.trainingSlot.findMany({
    where: slotWhere(scope, { startsAt: { gte: from, lt: to } }),
    orderBy: { startsAt: "asc" },
    include: {
      bookings: {
        orderBy: { createdAt: "asc" },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              memberNo: true,
              phone: true,
              userId: true,
              remindersEnabled: true,
            },
          },
        },
      },
    },
  });

  const memberIds = [
    ...new Set(
      slots.flatMap((slot) => slot.bookings.map((booking) => booking.memberId)),
    ),
  ];
  const creditsByMember = await creditsFor(memberIds);

  const toRosterRow = (booking: {
    id: string;
    status: string;
    member: {
      id: string;
      fullName: string;
      memberNo: string;
      phone: string | null;
      userId: string | null;
      remindersEnabled: boolean;
    };
  }): DayRosterMember => {
    const credit = creditsByMember.get(booking.member.id);
    return {
      bookingId: booking.id,
      memberId: booking.member.id,
      fullName: booking.member.fullName,
      memberNo: booking.member.memberNo,
      phone: booking.member.phone,
      status: booking.status as BookingStatus,
      hasAccount: booking.member.userId !== null,
      remindersEnabled: booking.member.remindersEnabled,
      hasPackage: credit !== undefined,
      sessionsRemaining: credit?.remaining ?? null,
      membershipDaysLeft: credit?.daysLeft ?? null,
    };
  };

  const daySlots: DaySlot[] = slots.map((slot) => {
    const seatRows = slot.bookings.filter((booking) =>
      SEAT_STATUSES.includes(booking.status),
    );
    const pendingRows = slot.bookings.filter(
      (booking) => booking.status === "bekliyor",
    );

    const endsAt = slot.startsAt.getTime() + slot.durationMinutes * 60_000;
    const past = endsAt < now.getTime();

    return {
      id: slot.id,
      startsAt: slot.startsAt,
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
      kind: slot.kind,
      title: slot.title,
      notes: slot.notes,
      status: slot.status,
      roster: seatRows.map(toRosterRow),
      pending: pendingRows.map(toRosterRow),
      emptySeats: Math.max(slot.capacity - seatRows.length, 0),
      needsAttendance:
        slot.status === "acik" &&
        slot.startsAt.getTime() < now.getTime() &&
        seatRows.some((booking) => booking.status === "onayli"),
      inProgress: slot.startsAt.getTime() <= now.getTime() && !past,
      past,
    };
  });

  return {
    dateKey: key,
    slots: daySlots,
    totalSeats: daySlots.reduce((sum, slot) => sum + slot.roster.length, 0),
    totalCapacity: daySlots.reduce((sum, slot) => sum + slot.capacity, 0),
    attendancePending: daySlots.filter((slot) => slot.needsAttendance).length,
    withoutAccount: new Set(
      daySlots.flatMap((slot) =>
        slot.roster.filter((row) => !row.hasAccount).map((row) => row.memberId),
      ),
    ).size,
  };
}

type CreditInfo = { remaining: number | null; daysLeft: number };

/** Birden çok sporcunun ders hakkı — üye başına ayrı sorgu yok. */
async function creditsFor(
  memberIds: string[],
): Promise<Map<string, CreditInfo>> {
  const map = new Map<string, CreditInfo>();
  if (memberIds.length === 0) return map;

  const now = new Date();

  const subscriptions = await prisma.memberSubscription.findMany({
    where: {
      memberId: { in: memberIds },
      status: "aktif",
      endDate: { gte: now },
    },
    orderBy: { endDate: "asc" },
    select: {
      memberId: true,
      startDate: true,
      endDate: true,
      sessionsTotal: true,
    },
  });

  // Aynı sporcuda birden çok aktif abonelik varsa en önce biten yürürlüktedir
  // (bkz. `getMembershipCredits`); sıralama yukarıda, ilk gelen kazanır.
  const current = new Map<string, (typeof subscriptions)[number]>();
  for (const row of subscriptions) {
    if (!current.has(row.memberId)) current.set(row.memberId, row);
  }
  if (current.size === 0) return map;

  const bookings = await prisma.slotBooking.findMany({
    where: { memberId: { in: [...current.keys()] } },
    select: {
      memberId: true,
      status: true,
      slot: { select: { startsAt: true } },
    },
  });

  const byMember = new Map<string, { status: BookingStatus; startsAt: Date }[]>();
  for (const row of bookings) {
    const list = byMember.get(row.memberId) ?? [];
    list.push({
      status: row.status as BookingStatus,
      startsAt: row.slot.startsAt,
    });
    byMember.set(row.memberId, list);
  }

  for (const [memberId, subscription] of current) {
    const inPeriod = (byMember.get(memberId) ?? []).filter(
      (booking) =>
        booking.startsAt >= subscription.startDate &&
        booking.startsAt <= subscription.endDate,
    );
    const credits = summarizeCredits({
      total: subscription.sessionsTotal,
      bookingStatuses: inPeriod.map((booking) => booking.status),
    });

    map.set(memberId, {
      remaining: credits.remaining,
      daysLeft: Math.ceil(
        (subscription.endDate.getTime() - now.getTime()) / MS_PER_DAY,
      ),
    });
  }

  return map;
}
