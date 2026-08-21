import "server-only";
import { prisma } from "@/lib/db";
import {
  summarizeCredits,
  type BookingStatus,
} from "@/domain/booking/credits";

/**
 * Üyelik = **ders paketi**. Bir paket "kaç gün geçerli" ve "kaç ders içeriyor"
 * bilgisini taşır; uygulamada ödeme/tahsilat takibi YOKTUR — para salonun
 * kendi yöntemiyle alınır. `priceMinor` yalnız paketin etiket fiyatıdır.
 */

/** Kuruş → "2.500,00 ₺" */
export function formatPriceTR(priceMinor: number, currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceMinor / 100);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gün başlangıcına (UTC 00:00) sabitler — abonelik sınırları saat tutmaz. */
function atStartOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export type MembershipOverview = {
  plans: {
    id: string;
    name: string;
    description: string | null;
    priceMinor: number;
    currency: string;
    durationDays: number;
    totalSessions: number | null;
    isActive: boolean;
    activeCount: number;
  }[];
  subscriptions: {
    id: string;
    memberId: string;
    memberName: string;
    memberNo: string;
    planName: string;
    startDate: Date;
    endDate: Date;
    status: string;
    /** Süresi geçmiş "aktif" kayıt burada `bitti` görünür. */
    effectiveStatus: string;
    daysLeft: number;
    sessionsTotal: number | null;
    sessionsUsed: number;
    sessionsReserved: number;
    sessionsRemaining: number | null;
  }[];
  activeCount: number;
  expiringSoon: number;
  /** Süresi var ama ders hakkı bitmiş üyelikler. */
  creditsExhausted: number;
  /** Durumu hâlâ `aktif` ama süresi dolmuş kayıt sayısı — kapatılmayı bekler. */
  staleActiveCount: number;
};

/**
 * Paketler + abonelikler + ders hakkı dökümü. Rezervasyonlar tek sorguda
 * çekilip abonelik dönemine göre eşleştirilir (üye başına ayrı sorgu yok).
 */
export async function getMembershipOverview(
  organizationId: string,
  { expiringWithinDays = 14 }: { expiringWithinDays?: number } = {},
): Promise<MembershipOverview> {
  const [planRows, subscriptionRows, bookingRows] = await Promise.all([
    prisma.membershipPlan.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { priceMinor: "asc" }],
      include: {
        _count: { select: { subscriptions: { where: { status: "aktif" } } } },
      },
    }),
    prisma.memberSubscription.findMany({
      where: { member: { organizationId } },
      orderBy: { endDate: "asc" },
      include: {
        member: { select: { id: true, fullName: true, memberNo: true } },
        plan: { select: { name: true } },
      },
    }),
    prisma.slotBooking.findMany({
      where: { member: { organizationId } },
      select: {
        memberId: true,
        status: true,
        slot: { select: { startsAt: true } },
      },
    }),
  ]);

  const bookingsByMember = new Map<
    string,
    { status: BookingStatus; startsAt: Date }[]
  >();
  for (const row of bookingRows) {
    const list = bookingsByMember.get(row.memberId) ?? [];
    list.push({ status: row.status as BookingStatus, startsAt: row.slot.startsAt });
    bookingsByMember.set(row.memberId, list);
  }

  const now = Date.now();

  const subscriptions = subscriptionRows.map((row) => {
    const daysLeft = Math.ceil((row.endDate.getTime() - now) / MS_PER_DAY);
    const inPeriod = (bookingsByMember.get(row.memberId) ?? []).filter(
      (booking) =>
        booking.startsAt >= row.startDate && booking.startsAt <= row.endDate,
    );
    const credits = summarizeCredits({
      total: row.sessionsTotal,
      bookingStatuses: inPeriod.map((booking) => booking.status),
    });

    return {
      id: row.id,
      memberId: row.member.id,
      memberName: row.member.fullName,
      memberNo: row.member.memberNo,
      planName: row.plan.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      effectiveStatus:
        row.status === "aktif" && daysLeft < 0 ? "bitti" : row.status,
      daysLeft,
      sessionsTotal: credits.total,
      sessionsUsed: credits.used,
      sessionsReserved: credits.reserved,
      sessionsRemaining: credits.remaining,
    };
  });

  const active = subscriptions.filter((s) => s.effectiveStatus === "aktif");

  return {
    plans: planRows.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      durationDays: plan.durationDays,
      totalSessions: plan.totalSessions,
      isActive: plan.isActive,
      activeCount: plan._count.subscriptions,
    })),
    subscriptions,
    activeCount: active.length,
    expiringSoon: active.filter(
      (s) => s.daysLeft >= 0 && s.daysLeft <= expiringWithinDays,
    ).length,
    creditsExhausted: active.filter((s) => s.sessionsRemaining === 0).length,
    staleActiveCount: subscriptions.filter(
      (s) => s.status === "aktif" && s.daysLeft < 0,
    ).length,
  };
}

/** Abonelik formundaki paket listesi — yalnız satıştaki paketler. */
export async function listActiveMembershipPlans(organizationId: string) {
  return prisma.membershipPlan.findMany({
    where: { organizationId, isActive: true },
    orderBy: { priceMinor: "asc" },
    select: {
      id: true,
      name: true,
      priceMinor: true,
      currency: true,
      durationDays: true,
      totalSessions: true,
    },
  });
}

export type SubscriptionResult =
  | { ok: true; startDate: Date; endDate: Date; renewed: boolean }
  | { ok: false; error: string };

/**
 * Üyelik başlatır ya da yeniler.
 *
 * Yenileme kuralı: sporcunun süresi dolmamış aktif bir üyeliği varsa yeni
 * dönem onun bittiği günün ertesinde başlar — kalan günler yanmaz. Ders
 * adedi pakete bakılarak kopyalanır (paket sonradan değişirse eski üyelik
 * kendi adedini korur).
 */
export async function startOrRenewSubscription(
  memberId: string,
  planId: string,
  { note }: { note?: string } = {},
): Promise<SubscriptionResult> {
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      organizationId: true,
      durationDays: true,
      totalSessions: true,
      isActive: true,
    },
  });
  if (!plan) return { ok: false, error: "Paket bulunamadı." };
  if (!plan.isActive) return { ok: false, error: "Bu paket satışta değil." };

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { organizationId: true },
  });
  if (!member || member.organizationId !== plan.organizationId) {
    return { ok: false, error: "Paket bu sporcunun salonuna ait değil." };
  }

  const today = atStartOfDay(new Date());

  const current = await prisma.memberSubscription.findFirst({
    where: { memberId, status: "aktif", endDate: { gte: today } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });

  const renewed = current !== null;
  const startDate = renewed
    ? new Date(atStartOfDay(current.endDate).getTime() + MS_PER_DAY)
    : today;
  const endDate = new Date(startDate.getTime() + plan.durationDays * MS_PER_DAY);

  await prisma.memberSubscription.create({
    data: {
      memberId,
      planId: plan.id,
      startDate,
      endDate,
      status: "aktif",
      sessionsTotal: plan.totalSessions,
      note,
    },
  });

  return { ok: true, startDate, endDate, renewed };
}

export const SUBSCRIPTION_STATUSES = [
  "aktif",
  "donduruldu",
  "iptal",
  "bitti",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Üyelik kaydını salon sınırı içinde bulur — yetki kontrolü için. */
export async function findSubscriptionInOrganization(
  subscriptionId: string,
  organizationId: string,
) {
  return prisma.memberSubscription.findFirst({
    where: { id: subscriptionId, member: { organizationId } },
    select: { id: true, memberId: true, status: true },
  });
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<void> {
  await prisma.memberSubscription.update({
    where: { id: subscriptionId },
    data: { status },
  });
}

/**
 * Süresi dolmuş "aktif" üyelikleri kapatır. Zamanlanmış iş yerine şimdilik
 * panelden elle tetiklenir; bir cron kurulduğunda çağıracağı fonksiyon budur.
 */
export async function closeExpiredSubscriptions(
  organizationId: string,
): Promise<number> {
  const expired = await prisma.memberSubscription.findMany({
    where: {
      status: "aktif",
      endDate: { lt: atStartOfDay(new Date()) },
      member: { organizationId },
    },
    select: { id: true },
  });
  if (expired.length === 0) return 0;

  const result = await prisma.memberSubscription.updateMany({
    where: { id: { in: expired.map((row) => row.id) } },
    data: { status: "bitti" },
  });
  return result.count;
}

export type MemberSubscriptionSummary = {
  id: string;
  planName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  sessionsTotal: number | null;
  daysLeft: number;
};

/** Bir sporcunun üyelik geçmişi — en yeni başta. */
export async function listMemberSubscriptions(
  memberId: string,
): Promise<MemberSubscriptionSummary[]> {
  const rows = await prisma.memberSubscription.findMany({
    where: { memberId },
    orderBy: { endDate: "desc" },
    include: { plan: { select: { name: true } } },
  });

  const now = Date.now();
  return rows.map((row) => {
    const daysLeft = Math.ceil((row.endDate.getTime() - now) / MS_PER_DAY);
    return {
      id: row.id,
      planName: row.plan.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status === "aktif" && daysLeft < 0 ? "bitti" : row.status,
      sessionsTotal: row.sessionsTotal,
      daysLeft,
    };
  });
}
