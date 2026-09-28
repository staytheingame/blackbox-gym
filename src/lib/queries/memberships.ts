import "server-only";
import { prisma } from "@/lib/db";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  summarizeCredits,
  type BookingStatus,
} from "@/domain/booking/credits";
import { summarizeDue, type DueStatus } from "@/domain/finance/dues";

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
    sessionsBurned: number;
    sessionsReserved: number;
    sessionsRemaining: number | null;
    currency: string;
    /** Anlaşılan tutar (kuruş) — paketin etiket fiyatı değil, bu üyeliğinki. */
    priceMinor: number;
    paidMinor: number;
    balanceMinor: number;
    dueStatus: DueStatus;
  }[];
  activeCount: number;
  expiringSoon: number;
  /** Süresi var ama ders hakkı bitmiş üyelikler. */
  creditsExhausted: number;
  /** Durumu hâlâ `aktif` ama süresi dolmuş kayıt sayısı — kapatılmayı bekler. */
  staleActiveCount: number;
  /** Ödemesi eksik üyelik sayısı ve toplam alacak (kuruş). */
  unpaidCount: number;
  unpaidTotalMinor: number;
};

/**
 * Paketler + abonelikler + ders hakkı dökümü. Rezervasyonlar tek sorguda
 * çekilip abonelik dönemine göre eşleştirilir (üye başına ayrı sorgu yok).
 */
export async function getMembershipOverview(
  scope: StaffScope,
  { expiringWithinDays = 14 }: { expiringWithinDays?: number } = {},
): Promise<MembershipOverview> {
  const [planRows, subscriptionRows, bookingRows, paymentRows] =
    await Promise.all([
      prisma.membershipPlan.findMany({
        where: { organizationId: scope.organizationId },
        orderBy: [{ isActive: "desc" }, { priceMinor: "asc" }],
        include: {
          _count: { select: { subscriptions: { where: { status: "aktif" } } } },
        },
      }),
      prisma.memberSubscription.findMany({
        where: { member: memberWhere(scope) },
        orderBy: { endDate: "asc" },
        include: {
          member: { select: { id: true, fullName: true, memberNo: true } },
          plan: { select: { name: true } },
        },
      }),
      prisma.slotBooking.findMany({
        where: { member: memberWhere(scope) },
        select: {
          memberId: true,
          status: true,
          slot: { select: { startsAt: true } },
        },
      }),
      // Üyelik başına tahsilat toplamı — abonelik başına ayrı sorgu (N+1) yok.
      prisma.payment.groupBy({
        by: ["subscriptionId"],
        where: {
          organizationId: scope.organizationId,
          subscriptionId: { not: null },
          member: memberWhere(scope),
        },
        _sum: { amountMinor: true },
      }),
    ]);

  const paidBySubscription = new Map(
    paymentRows.map((row) => [row.subscriptionId, row._sum.amountMinor ?? 0]),
  );

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
  const nowDate = new Date(now);

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

    const due = summarizeDue({
      priceMinor: row.priceMinor,
      paidMinor: paidBySubscription.get(row.id) ?? 0,
      endDate: row.endDate,
      now: nowDate,
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
      sessionsBurned: credits.burned,
      sessionsReserved: credits.reserved,
      sessionsRemaining: credits.remaining,
      currency: row.currency,
      priceMinor: due.priceMinor,
      paidMinor: due.paidMinor,
      balanceMinor: due.balanceMinor,
      dueStatus: due.status,
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
    unpaidCount: subscriptions.filter((s) => s.balanceMinor > 0).length,
    unpaidTotalMinor: subscriptions.reduce(
      (total, s) => total + s.balanceMinor,
      0,
    ),
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
  | {
      ok: true;
      subscriptionId: string;
      startDate: Date;
      endDate: Date;
      renewed: boolean;
      priceMinor: number;
      currency: string;
    }
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
  {
    note,
    priceMinor,
  }: {
    note?: string;
    /**
     * Anlaşılan tutar (kuruş). Verilmezse paketin etiket fiyatı kopyalanır;
     * indirim/pazarlık yapıldıysa çağıran yer düşürülmüş tutarı geçirir.
     */
    priceMinor?: number;
  } = {},
): Promise<SubscriptionResult> {
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      organizationId: true,
      durationDays: true,
      totalSessions: true,
      isActive: true,
      priceMinor: true,
      currency: true,
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

  const agreedPrice = Math.max(0, priceMinor ?? plan.priceMinor);

  const subscription = await prisma.memberSubscription.create({
    data: {
      memberId,
      planId: plan.id,
      startDate,
      endDate,
      status: "aktif",
      sessionsTotal: plan.totalSessions,
      priceMinor: agreedPrice,
      currency: plan.currency,
      note,
    },
  });

  return {
    ok: true,
    subscriptionId: subscription.id,
    startDate,
    endDate,
    renewed,
    priceMinor: agreedPrice,
    currency: plan.currency,
  };
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
 * Süresi dolmuş "aktif" üyelikleri kapatır.
 *
 * `organizationId` verilmezse TÜM salonlar için çalışır — zamanlanmış iş
 * (`/api/cron/hatirlatici`) böyle çağırır. Panelden elle tetiklendiğinde ise
 * yalnız o salonun kayıtlarına dokunulur.
 */
export async function closeExpiredSubscriptions(
  organizationId?: string,
): Promise<number> {
  const expired = await prisma.memberSubscription.findMany({
    where: {
      status: "aktif",
      endDate: { lt: atStartOfDay(new Date()) },
      ...(organizationId ? { member: { organizationId } } : {}),
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
