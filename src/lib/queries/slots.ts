import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStartInstant } from "@/lib/date";
import { slotWhere, type StaffScope } from "@/lib/auth/scope";
import {
  evaluateBooking,
  summarizeCredits,
  type BookingRefusal,
  type BookingStatus,
} from "@/domain/booking/credits";
import {
  promotableFromWaitlist,
  waitlistPosition,
} from "@/domain/booking/waitlist";
import { logTraining, revertTrainingLog } from "@/lib/queries/performance";
import {
  recordSessionEarning,
  revokeSessionEarning,
} from "@/lib/queries/finance";

export const SLOT_KINDS = [
  "boks",
  "kickbox",
  "fight_prep",
  "kondisyon",
  "teknik",
] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const SLOT_KIND_LABEL: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
  teknik: "Teknik Çalışma",
};

/** Yer tutan kayıtlar — kontenjan bunlara göre dolar. */
const SEAT_STATUSES = ["onayli", "katildi", "gelmedi"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Ders hakkı ────────────────────────────────────────────────

export type MembershipCredits = {
  subscriptionId: string;
  planName: string;
  startDate: Date;
  endDate: Date;
  daysLeft: number;
  total: number | null;
  used: number;
  reserved: number;
  remaining: number | null;
  unlimited: boolean;
};

/**
 * Sporcunun yürürlükteki üyeliği ve ders hakkı. Birden çok aktif abonelik
 * varsa (yenileme sırada bekliyorsa) **en önce biten** yürürlüktedir.
 */
export async function getMembershipCredits(
  memberId: string,
): Promise<MembershipCredits | null> {
  const now = new Date();

  const subscription = await prisma.memberSubscription.findFirst({
    where: { memberId, status: "aktif", endDate: { gte: now } },
    orderBy: { endDate: "asc" },
    include: { plan: { select: { name: true } } },
  });
  if (!subscription) return null;

  // Hak, aboneliğin dönemine düşen rezervasyonlara göre sayılır — önceki
  // dönemin dersleri yeni paketten düşmesin diye.
  const bookings = await prisma.slotBooking.findMany({
    where: {
      memberId,
      slot: {
        startsAt: { gte: subscription.startDate, lte: subscription.endDate },
      },
    },
    select: { status: true },
  });

  const credits = summarizeCredits({
    total: subscription.sessionsTotal,
    bookingStatuses: bookings.map((row) => row.status as BookingStatus),
  });

  return {
    subscriptionId: subscription.id,
    planName: subscription.plan.name,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    daysLeft: Math.ceil((subscription.endDate.getTime() - now.getTime()) / MS_PER_DAY),
    ...credits,
  };
}

// ── Slot listeleme ────────────────────────────────────────────

export type SlotSeat = {
  bookingId: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  status: BookingStatus;
};

export type SlotView = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  kind: string;
  title: string | null;
  notes: string | null;
  status: string;
  takenSeats: number;
  /** Onay bekleyen grup katılım istekleri. */
  pendingSeats: SlotSeat[];
  seats: SlotSeat[];
  /** Yoklaması alınmamış, başlangıcı geçmiş seans. */
  needsAttendance: boolean;
};

function toSeat(row: {
  id: string;
  status: string;
  member: { id: string; fullName: string; memberNo: string };
}): SlotSeat {
  return {
    bookingId: row.id,
    memberId: row.member.id,
    memberName: row.member.fullName,
    memberNo: row.member.memberNo,
    status: row.status as BookingStatus,
  };
}

function toSlotView(
  slot: {
    id: string;
    startsAt: Date;
    durationMinutes: number;
    capacity: number;
    kind: string;
    title: string | null;
    notes: string | null;
    status: string;
    bookings: {
      id: string;
      status: string;
      member: { id: string; fullName: string; memberNo: string };
    }[];
  },
  now: Date,
): SlotView {
  const seats = slot.bookings.filter((b) => SEAT_STATUSES.includes(b.status));
  const pending = slot.bookings.filter((b) => b.status === "bekliyor");

  return {
    id: slot.id,
    startsAt: slot.startsAt,
    durationMinutes: slot.durationMinutes,
    capacity: slot.capacity,
    kind: slot.kind,
    title: slot.title,
    notes: slot.notes,
    status: slot.status,
    takenSeats: seats.length,
    seats: seats.map(toSeat),
    pendingSeats: pending.map(toSeat),
    needsAttendance:
      slot.status === "acik" &&
      slot.startsAt.getTime() < now.getTime() &&
      seats.some((b) => b.status === "onayli"),
  };
}

const slotInclude = {
  bookings: {
    include: {
      member: { select: { id: true, fullName: true, memberNo: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

/**
 * Belirli bir aralıktaki slotlar — haftalık tablo bunu kullanır.
 *
 * Kapsam antrenörse yalnız **kendi açtığı** seanslar döner; yönetici salonun
 * tamamını görür (bkz. `src/lib/auth/scope.ts`).
 */
export async function listSlots(
  scope: StaffScope,
  { from, to }: { from: Date; to: Date },
): Promise<SlotView[]> {
  const rows = await prisma.trainingSlot.findMany({
    where: slotWhere(scope, { startsAt: { gte: from, lt: to } }),
    orderBy: { startsAt: "asc" },
    include: slotInclude,
  });

  const now = new Date();
  return rows.map((row) => toSlotView(row, now));
}

/** Yoklaması alınmamış geçmiş seanslar — en yeni başta. */
export async function listSlotsNeedingAttendance(
  scope: StaffScope,
  { limit = 30 }: { limit?: number } = {},
): Promise<SlotView[]> {
  const now = new Date();
  const rows = await prisma.trainingSlot.findMany({
    where: slotWhere(scope, {
      status: "acik",
      startsAt: { lt: now },
      bookings: { some: { status: "onayli" } },
    }),
    orderBy: { startsAt: "desc" },
    take: limit,
    include: slotInclude,
  });

  return rows.map((row) => toSlotView(row, now));
}

export async function countPendingBookings(scope: StaffScope): Promise<number> {
  return prisma.slotBooking.count({
    where: { status: "bekliyor", slot: slotWhere(scope, { status: "acik" }) },
  });
}

export async function countSlotsNeedingAttendance(
  scope: StaffScope,
): Promise<number> {
  return prisma.trainingSlot.count({
    where: slotWhere(scope, {
      status: "acik",
      startsAt: { lt: new Date() },
      bookings: { some: { status: "onayli" } },
    }),
  });
}

export type PendingRequest = {
  bookingId: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  note: string | null;
  requestedAt: Date;
  slotId: string;
  startsAt: Date;
  durationMinutes: number;
  kind: string;
  capacity: number;
  takenSeats: number;
  /** Slotta hâlihazırda kimler var — antrenör eşleştirmeyi görsün. */
  currentMembers: string[];
};

/** Grup dersi katılım istekleri — antrenörün onay kuyruğu. */
export async function listPendingRequests(
  scope: StaffScope,
): Promise<PendingRequest[]> {
  const rows = await prisma.slotBooking.findMany({
    where: {
      status: "bekliyor",
      slot: slotWhere(scope, { status: "acik", startsAt: { gte: new Date() } }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      member: { select: { id: true, fullName: true, memberNo: true } },
      slot: { include: slotInclude },
    },
  });

  return rows.map((row) => {
    const seats = row.slot.bookings.filter((b) =>
      SEAT_STATUSES.includes(b.status),
    );
    return {
      bookingId: row.id,
      memberId: row.member.id,
      memberName: row.member.fullName,
      memberNo: row.member.memberNo,
      note: row.note,
      requestedAt: row.createdAt,
      slotId: row.slot.id,
      startsAt: row.slot.startsAt,
      durationMinutes: row.slot.durationMinutes,
      kind: row.slot.kind,
      capacity: row.slot.capacity,
      takenSeats: seats.length,
      currentMembers: seats.map((b) => b.member.fullName),
    };
  });
}

export type MemberBookingView = {
  bookingId: string;
  status: BookingStatus;
  slotId: string;
  startsAt: Date;
  durationMinutes: number;
  kind: string;
  title: string | null;
  capacity: number;
  /** Aynı seanstaki diğer sporcular (grup dersiyse). */
  others: string[];
  /** Bekleme listesindeyse kaçıncı sırada (1 = ilk); değilse `null`. */
  queuePosition: number | null;
};

export async function listMemberBookings(
  memberId: string,
  { limit = 60 }: { limit?: number } = {},
): Promise<MemberBookingView[]> {
  const rows = await prisma.slotBooking.findMany({
    where: { memberId },
    orderBy: { slot: { startsAt: "desc" } },
    take: limit,
    include: { slot: { include: slotInclude } },
  });

  return rows.map((row) => ({
    bookingId: row.id,
    status: row.status as BookingStatus,
    slotId: row.slot.id,
    startsAt: row.slot.startsAt,
    durationMinutes: row.slot.durationMinutes,
    kind: row.slot.kind,
    title: row.slot.title,
    capacity: row.slot.capacity,
    others: row.slot.bookings
      .filter((b) => b.memberId !== memberId && SEAT_STATUSES.includes(b.status))
      .map((b) => b.member.fullName),
    queuePosition:
      row.status === "bekliyor"
        ? waitlistPosition(
            row.slot.bookings
              .filter((b) => b.status === "bekliyor")
              .map((b) => ({
                bookingId: b.id,
                memberId: b.memberId,
                requestedAt: b.createdAt,
              })),
            row.id,
          )
        : null,
  }));
}

/** Gelişim ekranı için: yoklama geçmişi (saf domain fonksiyonuna gider). */
export async function listAttendanceRecords(memberId: string) {
  const rows = await prisma.slotBooking.findMany({
    where: { memberId },
    select: { status: true, slot: { select: { startsAt: true } } },
  });
  return rows.map((row) => ({ status: row.status, startsAt: row.slot.startsAt }));
}

// ── Slot açma / kapama (antrenör) ─────────────────────────────

export type CreateSlotInput = {
  organizationId: string;
  coachUserId: string;
  /** İlk seansın başlangıcı. */
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  kind: SlotKind;
  title?: string;
  notes?: string;
  /** 1 = tek seferlik; >1 ise haftalık tekrarla bu kadar hafta açılır. */
  repeatWeeks: number;
};

/** Aynı saate ikinci slot açılmasın — çakışma kontrolü. */
export async function createSlots(input: CreateSlotInput): Promise<number> {
  const starts: Date[] = [];
  for (let week = 0; week < Math.max(input.repeatWeeks, 1); week++) {
    starts.push(new Date(input.startsAt.getTime() + week * 7 * MS_PER_DAY));
  }

  const existing = await prisma.trainingSlot.findMany({
    where: {
      organizationId: input.organizationId,
      coachUserId: input.coachUserId,
      startsAt: { in: starts },
    },
    select: { startsAt: true },
  });
  const taken = new Set(existing.map((row) => row.startsAt.getTime()));
  const fresh = starts.filter((date) => !taken.has(date.getTime()));
  if (fresh.length === 0) return 0;

  const result = await prisma.trainingSlot.createMany({
    data: fresh.map((startsAt) => ({
      organizationId: input.organizationId,
      coachUserId: input.coachUserId,
      startsAt,
      durationMinutes: input.durationMinutes,
      capacity: input.capacity,
      kind: input.kind,
      title: input.title,
      notes: input.notes,
    })),
  });
  return result.count;
}

/** Seansı iptal eder; kayıtlı sporcuların rezervasyonu da iptal olur
 *  (hakları geri döner — iptal hak yakmaz). */
export async function cancelSlot(slotId: string): Promise<void> {
  const slot = await prisma.trainingSlot.findUnique({
    where: { id: slotId },
    select: { organizationId: true },
  });

  await prisma.$transaction([
    prisma.slotBooking.updateMany({
      where: { slotId, status: { in: ["onayli", "bekliyor"] } },
      data: { status: "iptal", decidedAt: new Date() },
    }),
    prisma.trainingSlot.update({
      where: { id: slotId },
      data: { status: "iptal" },
    }),
  ]);

  // Yapılmayan ders hakediş doğurmaz — ödenmemiş kalem geri alınır.
  if (slot) await revokeSessionEarning(slot.organizationId, slotId);
}

/**
 * Slotu **kapsam içinde** bulur: yönetici salonun her seansına, antrenör
 * yalnız kendi açtığı seansa dokunabilir. Bulunamazsa `null` — çağıran yer
 * "yetkin yok" der.
 */
export async function findSlotInScope(scope: StaffScope, slotId: string) {
  return prisma.trainingSlot.findFirst({
    where: slotWhere(scope, { id: slotId }),
    include: slotInclude,
  });
}

// ── Rezervasyon (üye) ─────────────────────────────────────────

export type BookResult =
  | { ok: true; kind: "rezerve" | "grup-istegi" }
  | { ok: false; reason: BookingRefusal };

/**
 * Sporcu bir slotu kapar. Yer boşsa doğrudan rezerve olur; doluysa
 * "bekliyor" düşer ve antrenör onayına gider (grup dersi).
 */
export async function bookSlot(
  memberId: string,
  slotId: string,
  note?: string,
): Promise<BookResult> {
  const slot = await prisma.trainingSlot.findUnique({
    where: { id: slotId },
    include: { bookings: { select: { memberId: true, status: true } } },
  });
  if (!slot) return { ok: false, reason: "seans-iptal" };

  const credits = await getMembershipCredits(memberId);

  const decision = evaluateBooking({
    slot: {
      startsAt: slot.startsAt,
      status: slot.status,
      capacity: slot.capacity,
      takenSeats: slot.bookings.filter((b) => SEAT_STATUSES.includes(b.status))
        .length,
    },
    membership: {
      endDate: credits?.endDate ?? null,
      remainingCredits: credits ? credits.remaining : null,
    },
    alreadyBooked: slot.bookings.some(
      (b) =>
        b.memberId === memberId &&
        ["onayli", "bekliyor", "katildi", "gelmedi"].includes(b.status),
    ),
    now: new Date(),
  });

  if (!decision.ok) return decision;

  const status: BookingStatus =
    decision.kind === "rezerve" ? "onayli" : "bekliyor";

  // Daha önce iptal edilmiş kayıt varsa yenisini açmak yerine onu diriltir
  // (slotId+memberId benzersiz).
  await prisma.slotBooking.upsert({
    where: { slotId_memberId: { slotId, memberId } },
    update: { status, note, decidedAt: null, decidedByUserId: null },
    create: { slotId, memberId, status, note },
  });

  return { ok: true, kind: decision.kind };
}

// ── Bekleme listesi ───────────────────────────────────────────

export type PromotedBooking = {
  bookingId: string;
  memberId: string;
  memberName: string;
  /** Hesabını kurmamış sporcuya bildirim düşmez. */
  memberUserId: string | null;
  organizationId: string;
  startsAt: Date;
};

/**
 * Seansta yer açıldıysa bekleme listesinin başındaki sporcuları onaylıya
 * çeker — antrenör onayı beklemeden, çünkü kontenjan zaten vardı.
 *
 * Kontenjanı ASLA büyütmez: birebir seansı grup dersine çevirmek
 * antrenörün kararıdır (`approveRequest`). Burada yalnız boşalan yer
 * kadar sporcu yükselir.
 */
export async function promoteWaitlist(
  slotId: string,
): Promise<PromotedBooking[]> {
  const slot = await prisma.trainingSlot.findUnique({
    where: { id: slotId },
    include: {
      bookings: {
        include: {
          member: {
            select: { id: true, fullName: true, userId: true, organizationId: true },
          },
        },
      },
    },
  });
  if (!slot) return [];

  const takenSeats = slot.bookings.filter((booking) =>
    SEAT_STATUSES.includes(booking.status),
  ).length;

  const waiting = slot.bookings.filter((booking) => booking.status === "bekliyor");

  const promotable = promotableFromWaitlist({
    capacity: slot.capacity,
    takenSeats,
    waitlist: waiting.map((booking) => ({
      bookingId: booking.id,
      memberId: booking.memberId,
      requestedAt: booking.createdAt,
    })),
    slotStartsAt: slot.startsAt,
    slotStatus: slot.status,
    now: new Date(),
  });
  if (promotable.length === 0) return [];

  const ids = promotable.map((entry) => entry.bookingId);
  const updated = await prisma.slotBooking.updateMany({
    where: { id: { in: ids }, status: "bekliyor" },
    data: { status: "onayli", decidedAt: new Date() },
  });
  if (updated.count === 0) return [];

  return promotable.flatMap((entry) => {
    const booking = waiting.find((row) => row.id === entry.bookingId);
    if (!booking) return [];
    return [
      {
        bookingId: booking.id,
        memberId: booking.member.id,
        memberName: booking.member.fullName,
        memberUserId: booking.member.userId,
        organizationId: booking.member.organizationId,
        startsAt: slot.startsAt,
      },
    ];
  });
}

export type CancelBookingResult = {
  ok: boolean;
  /** İptal yer açtıysa kuyruktan yükselenler — çağıran bildirim gönderir. */
  promoted: PromotedBooking[];
};

/**
 * Sporcu kendi rezervasyonunu iptal eder — hakkı geri döner ve boşalan
 * yere bekleme listesinden sıradaki sporcu geçer.
 */
export async function cancelBooking(
  memberId: string,
  bookingId: string,
): Promise<CancelBookingResult> {
  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, memberId },
    select: { slotId: true },
  });
  if (!booking) return { ok: false, promoted: [] };

  const result = await prisma.slotBooking.updateMany({
    where: {
      id: bookingId,
      memberId,
      status: { in: ["onayli", "bekliyor"] },
    },
    data: { status: "iptal", decidedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, promoted: [] };

  return { ok: true, promoted: await promoteWaitlist(booking.slotId) };
}

// ── Onay & yoklama (antrenör) ─────────────────────────────────

/**
 * Grup katılım isteğini onaylar: kontenjan doluysa bir kişilik büyütülür,
 * böylece birebir seans grup dersine döner.
 */
export async function approveRequest(
  bookingId: string,
  decidedByUserId: string,
): Promise<boolean> {
  const booking = await prisma.slotBooking.findUnique({
    where: { id: bookingId },
    include: { slot: { include: { bookings: { select: { status: true } } } } },
  });
  if (!booking || booking.status !== "bekliyor") return false;

  const taken = booking.slot.bookings.filter((b) =>
    SEAT_STATUSES.includes(b.status),
  ).length;

  await prisma.$transaction(async (tx) => {
    if (taken >= booking.slot.capacity) {
      await tx.trainingSlot.update({
        where: { id: booking.slotId },
        data: { capacity: taken + 1 },
      });
    }
    await tx.slotBooking.update({
      where: { id: bookingId },
      data: { status: "onayli", decidedAt: new Date(), decidedByUserId },
    });
  });

  return true;
}

export async function rejectRequest(
  bookingId: string,
  decidedByUserId: string,
): Promise<void> {
  await prisma.slotBooking.updateMany({
    where: { id: bookingId, status: "bekliyor" },
    data: { status: "reddedildi", decidedAt: new Date(), decidedByUserId },
  });
}

/**
 * Yoklama. "katıldı" seansı antrenman kaydına çevirir (puan + rozet + gelişim
 * grafiği); "gelmedi" yalnız hakkı yakar, antrenman kaydı üretmez.
 * İşaret değiştirilirse önceki antrenman kaydı geri alınır.
 */
export async function markAttendance(
  bookingId: string,
  attended: boolean,
  decidedByUserId: string,
): Promise<boolean> {
  const booking = await prisma.slotBooking.findUnique({
    where: { id: bookingId },
    include: { slot: true },
  });
  if (!booking) return false;
  if (booking.slot.startsAt.getTime() > Date.now()) return false;

  if (booking.trainingLogId) {
    await revertTrainingLog(booking.memberId, booking.trainingLogId);
  }

  let trainingLogId: string | null = null;
  if (attended) {
    trainingLogId = await logTraining(
      booking.memberId,
      {
        type: booking.slot.kind === "teknik" ? "boks" : booking.slot.kind,
        durationMinutes: booking.slot.durationMinutes,
        intensity: 6,
        notes: booking.slot.title
          ? `Ders: ${booking.slot.title}`
          : "Salon dersi",
      },
      decidedByUserId,
    );
  }

  await prisma.slotBooking.update({
    where: { id: bookingId },
    data: {
      status: attended ? "katildi" : "gelmedi",
      decidedAt: new Date(),
      decidedByUserId,
      trainingLogId,
    },
  });

  // Ders verilmiş sayılır (gelmeyen de salonun saatini tutmuştur) — seansı
  // AÇAN antrenörün hakedişi burada doğar. Seans başına tek satırdır;
  // grup dersinde ikinci sporcu ikinci ödeme üretmez.
  await recordSessionEarning({
    organizationId: booking.slot.organizationId,
    slotId: booking.slotId,
    coachUserId: booking.slot.coachUserId,
    memberId: booking.slot.capacity === 1 ? booking.memberId : null,
    earnedAt: booking.slot.startsAt,
  });

  return true;
}

/** Yoklaması alınan tüm seansı kapatır — listede tekrar çıkmasın. */
export async function closeSlot(slotId: string): Promise<void> {
  await prisma.trainingSlot.update({
    where: { id: slotId },
    data: { status: "tamamlandi" },
  });
}

// ── Panel sayaçları ───────────────────────────────────────────

export async function countSessionsThisWeek(
  organizationId: string,
): Promise<number> {
  return prisma.trainingSlot.count({
    where: {
      organizationId,
      status: { not: "iptal" },
      startsAt: { gte: getWeekStartInstant(new Date()) },
    },
  });
}
