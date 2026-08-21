import "server-only";
import { prisma } from "@/lib/db";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import { normalizeRole } from "@/lib/auth/roles";
import {
  addGymDays,
  getMonthStartInstant,
  toGymMonthKey,
} from "@/lib/date";
import {
  NO_COMPENSATION,
  revenueShareMinor,
  salaryAccrualMinor,
  sessionEarningMinor,
  type Compensation,
  type CompensationModel,
  type EarningSource,
} from "@/domain/finance/earnings";
import {
  normalizeExpenseCategory,
  normalizePaymentMethod,
  rollup,
  type ExpenseCategory,
  type LedgerTotals,
  type PaymentMethod,
} from "@/domain/finance/ledger";
import { periodContaining, type Period, type PeriodKind } from "@/domain/finance/period";

/**
 * MALİYE SORGULARI — kasa, hakediş, borç.
 *
 * Yetki kuralı burada da geçerlidir: **antrenör yalnız kendi sporcularının
 * ödemesini ve kendi hakedişini görür**; salon geneli gelir/gider yalnız
 * yöneticidedir (kullanıcı kararı). Bu yüzden sporcuya bağlı sorgular
 * `StaffScope`, salon geneli sorgular çıplak `organizationId` alır ve
 * çağrıldıkları yerde `requireAdmin` ile korunur.
 */

// ── Antrenör hakediş ayarı ────────────────────────────────────

export type CoachCompensationRow = Compensation & {
  coachUserId: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  currency: string;
};

function toCompensation(row: {
  model: string;
  perSessionMinor: number | null;
  revenueShareBps: number | null;
  monthlySalaryMinor: number | null;
  monthlySessionQuota: number | null;
  currency: string;
} | null): Compensation {
  if (!row) return NO_COMPENSATION;
  return {
    model: row.model as CompensationModel,
    perSessionMinor: row.perSessionMinor,
    revenueShareBps: row.revenueShareBps,
    monthlySalaryMinor: row.monthlySalaryMinor,
    monthlySessionQuota: row.monthlySessionQuota,
    currency: row.currency,
  };
}

export async function getCompensation(
  coachUserId: string,
): Promise<Compensation> {
  const row = await prisma.coachCompensation.findUnique({
    where: { coachUserId },
  });
  return toCompensation(row);
}

/** Kadro + hakediş ayarı — yönetim ekranı tek listede gösterir. */
export async function listCoachCompensations(
  organizationId: string,
): Promise<CoachCompensationRow[]> {
  const staff = await prisma.organizationUser.findMany({
    where: { organizationId, role: { in: ["coach", "admin", "staff"] } },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
          compensation: true,
        },
      },
    },
  });

  return staff.map((row) => {
    const compensation = toCompensation(row.user.compensation);
    return {
      ...compensation,
      currency: compensation.currency ?? "TRY",
      coachUserId: row.user.id,
      displayName: row.user.profile?.displayName ?? row.user.email,
      email: row.user.email,
      role: normalizeRole(row.role),
      status: row.status,
    };
  });
}

export type SaveCompensationInput = {
  organizationId: string;
  coachUserId: string;
  model: CompensationModel;
  perSessionMinor: number | null;
  revenueShareBps: number | null;
  monthlySalaryMinor: number | null;
  monthlySessionQuota: number | null;
  note?: string | null;
};

/**
 * Hakediş ayarını yazar. Geçmiş hakedişlere DOKUNMAZ — tutarlar doğdukları
 * anda `CoachEarning` satırına dondurulmuştur; oran değişimi ileriye işler.
 */
export async function saveCompensation(
  input: SaveCompensationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await prisma.organizationUser.findFirst({
    where: { organizationId: input.organizationId, userId: input.coachUserId },
    select: { id: true },
  });
  if (!staff) return { ok: false, error: "Bu kişi salonun kadrosunda değil." };

  const data = {
    model: input.model,
    perSessionMinor: input.perSessionMinor,
    revenueShareBps: input.revenueShareBps,
    monthlySalaryMinor: input.monthlySalaryMinor,
    monthlySessionQuota: input.monthlySessionQuota,
    note: input.note ?? null,
  };

  await prisma.coachCompensation.upsert({
    where: { coachUserId: input.coachUserId },
    update: data,
    create: {
      organizationId: input.organizationId,
      coachUserId: input.coachUserId,
      ...data,
    },
  });

  return { ok: true };
}

// ── Tahsilat ──────────────────────────────────────────────────

export type RecordPaymentInput = {
  organizationId: string;
  memberId: string;
  subscriptionId?: string | null;
  amountMinor: number;
  method: PaymentMethod;
  paidAt: Date;
  note?: string | null;
  recordedByUserId: string;
};

export type RecordPaymentResult =
  | { ok: true; paymentId: string; earningMinor: number }
  | { ok: false; error: string };

/**
 * Sporcudan alınan parayı yazar ve — sporcunun sorumlu antrenörü gelir payı
 * alıyorsa — hakediş satırını aynı işlemde üretir.
 *
 * Hakediş `sourceKey = payment.id` ile tekildir: aynı tahsilat iki kez pay
 * doğuramaz (ödeme silinirse hakediş de `onDelete: Cascade` ile gider).
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  if (input.amountMinor <= 0) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalı." };
  }

  const member = await prisma.member.findFirst({
    where: { id: input.memberId, organizationId: input.organizationId },
    select: { id: true, assignedCoachUserId: true },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };

  if (input.subscriptionId) {
    const subscription = await prisma.memberSubscription.findFirst({
      where: { id: input.subscriptionId, memberId: member.id },
      select: { id: true },
    });
    if (!subscription) {
      return { ok: false, error: "Üyelik bu sporcuya ait değil." };
    }
  }

  const compensation = member.assignedCoachUserId
    ? await getCompensation(member.assignedCoachUserId)
    : NO_COMPENSATION;
  const shareMinor = revenueShareMinor(compensation, input.amountMinor);

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        organizationId: input.organizationId,
        memberId: member.id,
        subscriptionId: input.subscriptionId ?? null,
        amountMinor: input.amountMinor,
        method: input.method,
        paidAt: input.paidAt,
        note: input.note ?? null,
        recordedByUserId: input.recordedByUserId,
      },
    });

    if (shareMinor > 0 && member.assignedCoachUserId) {
      await tx.coachEarning.create({
        data: {
          organizationId: input.organizationId,
          coachUserId: member.assignedCoachUserId,
          memberId: member.id,
          sourceType: "gelir_payi",
          sourceKey: created.id,
          paymentId: created.id,
          amountMinor: shareMinor,
          earnedAt: input.paidAt,
        },
      });
    }

    return created;
  });

  return { ok: true, paymentId: payment.id, earningMinor: shareMinor };
}

export async function deletePayment(
  organizationId: string,
  paymentId: string,
): Promise<{ ok: boolean }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId },
    select: { id: true },
  });
  if (!payment) return { ok: false };

  // Hakediş satırı `onDelete: Cascade` ile birlikte silinir.
  await prisma.payment.delete({ where: { id: payment.id } });
  return { ok: true };
}

export type PaymentRow = {
  id: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  planName: string | null;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  paidAt: Date;
  note: string | null;
};

/** Tahsilat dökümü — kapsam içindeki sporcuların ödemeleri, en yeni başta. */
export async function listPayments(
  scope: StaffScope,
  { from, to, limit = 200 }: { from?: Date; to?: Date; limit?: number } = {},
): Promise<PaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: {
      organizationId: scope.organizationId,
      member: memberWhere(scope),
      ...(from || to
        ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    },
    orderBy: { paidAt: "desc" },
    take: limit,
    include: {
      member: { select: { id: true, fullName: true, memberNo: true } },
      subscription: { select: { plan: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    memberId: row.member.id,
    memberName: row.member.fullName,
    memberNo: row.member.memberNo,
    planName: row.subscription?.plan.name ?? null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    method: normalizePaymentMethod(row.method),
    paidAt: row.paidAt,
    note: row.note,
  }));
}

/** Kapsam içindeki tahsilat toplamı (kuruş). */
export async function sumPayments(
  scope: StaffScope,
  { from, to }: { from: Date; to: Date },
): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      organizationId: scope.organizationId,
      member: memberWhere(scope),
      paidAt: { gte: from, lt: to },
    },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// ── Gider ─────────────────────────────────────────────────────

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  title: string;
  amountMinor: number;
  currency: string;
  spentAt: Date;
  note: string | null;
  /** Sabit gider şablonundan ya da hakediş ödemesinden geldiyse dolu. */
  sourceKey: string | null;
};

export async function listExpenses(
  organizationId: string,
  { from, to, limit = 200 }: { from?: Date; to?: Date; limit?: number } = {},
): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: {
      organizationId,
      ...(from || to
        ? { spentAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    },
    orderBy: { spentAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    category: normalizeExpenseCategory(row.category),
    title: row.title,
    amountMinor: row.amountMinor,
    currency: row.currency,
    spentAt: row.spentAt,
    note: row.note,
    sourceKey: row.sourceKey,
  }));
}

export type RecordExpenseInput = {
  organizationId: string;
  category: ExpenseCategory;
  title: string;
  amountMinor: number;
  spentAt: Date;
  note?: string | null;
  recordedByUserId: string;
  sourceKey?: string | null;
};

export async function recordExpense(
  input: RecordExpenseInput,
): Promise<{ ok: true; expenseId: string } | { ok: false; error: string }> {
  if (input.amountMinor <= 0) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalı." };
  }

  if (input.sourceKey) {
    const existing = await prisma.expense.findUnique({
      where: { sourceKey: input.sourceKey },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "Bu gider zaten işlenmiş." };
  }

  const expense = await prisma.expense.create({
    data: {
      organizationId: input.organizationId,
      category: input.category,
      title: input.title,
      amountMinor: input.amountMinor,
      spentAt: input.spentAt,
      note: input.note ?? null,
      recordedByUserId: input.recordedByUserId,
      sourceKey: input.sourceKey ?? null,
    },
  });

  return { ok: true, expenseId: expense.id };
}

export async function deleteExpense(
  organizationId: string,
  expenseId: string,
): Promise<{ ok: boolean }> {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, organizationId },
    select: { id: true, payout: { select: { id: true } } },
  });
  if (!expense) return { ok: false };
  // Hakediş ödemesinden doğan gider elle silinmez — ödemeyi geri al.
  if (expense.payout) return { ok: false };

  await prisma.expense.delete({ where: { id: expense.id } });
  return { ok: true };
}

export async function sumExpenses(
  organizationId: string,
  { from, to }: { from: Date; to: Date },
): Promise<number> {
  const result = await prisma.expense.aggregate({
    where: { organizationId, spentAt: { gte: from, lt: to } },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// ── Sabit (tekrarlayan) giderler ──────────────────────────────

export type RecurringExpenseRow = {
  id: string;
  category: ExpenseCategory;
  title: string;
  amountMinor: number;
  currency: string;
  dayOfMonth: number;
  isActive: boolean;
  /** Bu ay için gider satırı üretildi mi? */
  appliedThisMonth: boolean;
};

export async function listRecurringExpenses(
  organizationId: string,
  now: Date = new Date(),
): Promise<RecurringExpenseRow[]> {
  const monthKey = toGymMonthKey(now);
  const [rows, applied] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }],
    }),
    prisma.expense.findMany({
      where: {
        organizationId,
        sourceKey: { startsWith: `sabit:`, endsWith: `:${monthKey}` },
      },
      select: { sourceKey: true },
    }),
  ]);

  const appliedKeys = new Set(applied.map((row) => row.sourceKey));

  return rows.map((row) => ({
    id: row.id,
    category: normalizeExpenseCategory(row.category),
    title: row.title,
    amountMinor: row.amountMinor,
    currency: row.currency,
    dayOfMonth: row.dayOfMonth,
    isActive: row.isActive,
    appliedThisMonth: appliedKeys.has(recurringSourceKey(row.id, monthKey)),
  }));
}

function recurringSourceKey(templateId: string, monthKey: string): string {
  return `sabit:${templateId}:${monthKey}`;
}

export async function saveRecurringExpense(input: {
  organizationId: string;
  category: ExpenseCategory;
  title: string;
  amountMinor: number;
  dayOfMonth: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.amountMinor <= 0) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalı." };
  }
  await prisma.recurringExpense.create({
    data: {
      organizationId: input.organizationId,
      category: input.category,
      title: input.title,
      amountMinor: input.amountMinor,
      // Ayın 29–31'i her ayda yok; 28'e çekmek "bu ay atlandı" durumunu önler.
      dayOfMonth: Math.min(28, Math.max(1, input.dayOfMonth)),
    },
  });
  return { ok: true };
}

export async function setRecurringExpenseActive(
  organizationId: string,
  id: string,
  isActive: boolean,
): Promise<void> {
  await prisma.recurringExpense.updateMany({
    where: { id, organizationId },
    data: { isActive },
  });
}

/**
 * Bu ayın sabit giderlerini kasaya işler. İki kez basılırsa ikinci kez
 * yazmaz (`sourceKey` tekildir) — düğme güvenle tekrar tekrar basılabilir.
 */
export async function applyRecurringExpenses(
  organizationId: string,
  recordedByUserId: string,
  now: Date = new Date(),
): Promise<{ created: number; skipped: number }> {
  const monthKey = toGymMonthKey(now);
  const monthStart = getMonthStartInstant(now);

  const templates = await prisma.recurringExpense.findMany({
    where: { organizationId, isActive: true },
  });

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const sourceKey = recurringSourceKey(template.id, monthKey);
    const spentAt = addGymDays(monthStart, template.dayOfMonth - 1);

    const result = await recordExpense({
      organizationId,
      category: normalizeExpenseCategory(template.category),
      title: template.title,
      amountMinor: template.amountMinor,
      spentAt,
      note: "Sabit gider — otomatik işlendi.",
      recordedByUserId,
      sourceKey,
    });

    if (result.ok) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

// ── Antrenör hakedişi ─────────────────────────────────────────

export type EarningRow = {
  id: string;
  coachUserId: string;
  coachName: string;
  memberName: string | null;
  sourceType: EarningSource;
  amountMinor: number;
  currency: string;
  earnedAt: Date;
  status: string;
  note: string | null;
};

export async function listEarnings(
  organizationId: string,
  {
    coachUserId,
    from,
    to,
    limit = 300,
  }: { coachUserId?: string; from?: Date; to?: Date; limit?: number } = {},
): Promise<EarningRow[]> {
  const rows = await prisma.coachEarning.findMany({
    where: {
      organizationId,
      ...(coachUserId ? { coachUserId } : {}),
      ...(from || to
        ? { earnedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    },
    orderBy: { earnedAt: "desc" },
    take: limit,
    include: {
      coach: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
      member: { select: { fullName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    coachUserId: row.coachUserId,
    coachName: row.coach.profile?.displayName ?? row.coach.email,
    memberName: row.member?.fullName ?? null,
    sourceType: row.sourceType as EarningSource,
    amountMinor: row.amountMinor,
    currency: row.currency,
    earnedAt: row.earnedAt,
    status: row.status,
    note: row.note,
  }));
}

export type CoachEarningSummary = {
  coachUserId: string;
  coachName: string;
  /** Dönemde verilen ders sayısı (yoklaması alınmış seans). */
  sessionsGiven: number;
  bySource: Record<EarningSource, number>;
  totalMinor: number;
  /** Henüz ödenmemiş hakediş (dönemden bağımsız, tüm zamanlar). */
  outstandingMinor: number;
  compensation: Compensation;
};

/**
 * Dönem bazında antrenör hakediş özeti — "kim ne kadar hak etti, kaç ders
 * verdi, ne kadarı ödenmedi". Yönetici ekranı ve antrenörün kendi ekranı
 * aynı fonksiyonu kullanır (antrenör tek kişilik listeyle çağırır).
 */
export async function getCoachEarningSummaries(
  organizationId: string,
  period: Period,
  { coachUserId }: { coachUserId?: string } = {},
): Promise<CoachEarningSummary[]> {
  const [staff, earnings, outstanding, sessions] = await Promise.all([
    prisma.organizationUser.findMany({
      where: {
        organizationId,
        role: { in: ["coach", "admin", "staff"] },
        ...(coachUserId ? { userId: coachUserId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
            compensation: true,
          },
        },
      },
    }),
    prisma.coachEarning.groupBy({
      by: ["coachUserId", "sourceType"],
      where: {
        organizationId,
        earnedAt: { gte: period.start, lt: period.end },
        ...(coachUserId ? { coachUserId } : {}),
      },
      _sum: { amountMinor: true },
    }),
    prisma.coachEarning.groupBy({
      by: ["coachUserId"],
      where: {
        organizationId,
        status: "tahakkuk",
        ...(coachUserId ? { coachUserId } : {}),
      },
      _sum: { amountMinor: true },
    }),
    prisma.trainingSlot.findMany({
      where: {
        organizationId,
        startsAt: { gte: period.start, lt: period.end },
        bookings: { some: { status: { in: ["katildi", "gelmedi"] } } },
        ...(coachUserId ? { coachUserId } : {}),
      },
      select: { coachUserId: true },
    }),
  ]);

  const sessionsByCoach = new Map<string, number>();
  for (const slot of sessions) {
    sessionsByCoach.set(
      slot.coachUserId,
      (sessionsByCoach.get(slot.coachUserId) ?? 0) + 1,
    );
  }

  const outstandingByCoach = new Map(
    outstanding.map((row) => [row.coachUserId, row._sum.amountMinor ?? 0]),
  );

  const earningsByCoach = new Map<string, Record<EarningSource, number>>();
  for (const row of earnings) {
    const current = earningsByCoach.get(row.coachUserId) ?? {
      ders: 0,
      gelir_payi: 0,
      maas: 0,
    };
    current[row.sourceType as EarningSource] = row._sum.amountMinor ?? 0;
    earningsByCoach.set(row.coachUserId, current);
  }

  return staff
    .map((row) => {
      const bySource = earningsByCoach.get(row.user.id) ?? {
        ders: 0,
        gelir_payi: 0,
        maas: 0,
      };
      return {
        coachUserId: row.user.id,
        coachName: row.user.profile?.displayName ?? row.user.email,
        sessionsGiven: sessionsByCoach.get(row.user.id) ?? 0,
        bySource,
        totalMinor: bySource.ders + bySource.gelir_payi + bySource.maas,
        outstandingMinor: outstandingByCoach.get(row.user.id) ?? 0,
        compensation: toCompensation(row.user.compensation),
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

/**
 * Ay kapanışında sabit maaşı tahakkuk ettirir. `sourceKey = "yyyy-mm"`
 * olduğu için aynı ay iki kez yazılmaz — düğmeye tekrar basmak zararsızdır.
 */
export async function accrueMonthlySalaries(
  organizationId: string,
  now: Date = new Date(),
): Promise<{ created: number; skipped: number }> {
  const monthKey = toGymMonthKey(now);
  const monthStart = getMonthStartInstant(now);

  const staff = await prisma.organizationUser.findMany({
    where: { organizationId, role: { in: ["coach", "admin", "staff"] }, status: "active" },
    include: { user: { select: { id: true, compensation: true } } },
  });

  let created = 0;
  let skipped = 0;

  for (const row of staff) {
    const amount = salaryAccrualMinor(toCompensation(row.user.compensation));
    if (amount <= 0) continue;

    const existing = await prisma.coachEarning.findUnique({
      where: {
        organizationId_sourceType_sourceKey: {
          organizationId,
          sourceType: "maas",
          sourceKey: `${row.user.id}:${monthKey}`,
        },
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.coachEarning.create({
      data: {
        organizationId,
        coachUserId: row.user.id,
        sourceType: "maas",
        sourceKey: `${row.user.id}:${monthKey}`,
        amountMinor: amount,
        earnedAt: monthStart,
        note: `${monthKey} maaş tahakkuku`,
      },
    });
    created += 1;
  }

  return { created, skipped };
}

/**
 * Yoklama işaretlenince ders hakedişini yazar.
 *
 * `sourceKey = slot.id` — **seans başına** tek satır. Grup dersinde beş kişi
 * yoklanmış olsa da antrenör bir ders vermiştir; kişi başına ödeme isteyen
 * salon `perSessionMinor`'ı kişi başı yazıp burada çarpar (bkz.
 * `src/domain/finance/earnings.ts`).
 *
 * `upsert` sayesinde yoklama tekrar tekrar işaretlense de tutar bir kez düşer.
 */
export async function recordSessionEarning(input: {
  organizationId: string;
  slotId: string;
  coachUserId: string;
  /** Birebir derste sporcu; grup dersinde `null`. */
  memberId: string | null;
  earnedAt: Date;
}): Promise<number> {
  const compensation = await getCompensation(input.coachUserId);
  const amount = sessionEarningMinor(compensation);
  if (amount <= 0) return 0;

  await prisma.coachEarning.upsert({
    where: {
      organizationId_sourceType_sourceKey: {
        organizationId: input.organizationId,
        sourceType: "ders",
        sourceKey: input.slotId,
      },
    },
    update: {},
    create: {
      organizationId: input.organizationId,
      coachUserId: input.coachUserId,
      memberId: input.memberId,
      sourceType: "ders",
      sourceKey: input.slotId,
      amountMinor: amount,
      earnedAt: input.earnedAt,
    },
  });

  return amount;
}

/** Seans iptal edildi/yoklama geri alındı — dersin hakedişi silinir (ödenmemişse). */
export async function revokeSessionEarning(
  organizationId: string,
  slotId: string,
): Promise<void> {
  await prisma.coachEarning.deleteMany({
    where: {
      organizationId,
      sourceType: "ders",
      sourceKey: slotId,
      status: "tahakkuk",
    },
  });
}

export type PayoutResult =
  | { ok: true; payoutId: string; amountMinor: number; count: number }
  | { ok: false; error: string };

/**
 * Antrenöre ödeme yapar: dönemdeki ödenmemiş hakedişleri `odendi` işaretler,
 * bir `CoachPayout` ve ona bağlı bir `Expense` satırı üretir. Kasa parayı
 * **çıktığı gün** görür.
 */
export async function payCoach(input: {
  organizationId: string;
  coachUserId: string;
  period: Period;
  paidAt: Date;
  method: PaymentMethod;
  note?: string | null;
  recordedByUserId: string;
}): Promise<PayoutResult> {
  const pending = await prisma.coachEarning.findMany({
    where: {
      organizationId: input.organizationId,
      coachUserId: input.coachUserId,
      status: "tahakkuk",
      earnedAt: { gte: input.period.start, lt: input.period.end },
    },
    select: { id: true, amountMinor: true },
  });

  if (pending.length === 0) {
    return { ok: false, error: "Bu dönemde ödenecek hakediş yok." };
  }

  const total = pending.reduce((sum, row) => sum + row.amountMinor, 0);

  const coach = await prisma.user.findUnique({
    where: { id: input.coachUserId },
    select: { email: true, profile: { select: { displayName: true } } },
  });
  const coachName = coach?.profile?.displayName ?? coach?.email ?? "Antrenör";

  const payoutId = await prisma.$transaction(async (tx) => {
    const payout = await tx.coachPayout.create({
      data: {
        organizationId: input.organizationId,
        coachUserId: input.coachUserId,
        periodStart: input.period.start,
        periodEnd: input.period.end,
        amountMinor: total,
        paidAt: input.paidAt,
        method: input.method,
        note: input.note ?? null,
        recordedByUserId: input.recordedByUserId,
      },
    });

    const expense = await tx.expense.create({
      data: {
        organizationId: input.organizationId,
        category: "hakedis",
        title: `${coachName} — ${input.period.label} hakediş`,
        amountMinor: total,
        spentAt: input.paidAt,
        recordedByUserId: input.recordedByUserId,
        sourceKey: `hakedis:${payout.id}`,
      },
    });

    await tx.coachPayout.update({
      where: { id: payout.id },
      data: { expenseId: expense.id },
    });

    await tx.coachEarning.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: { status: "odendi", payoutId: payout.id },
    });

    return payout.id;
  });

  return { ok: true, payoutId, amountMinor: total, count: pending.length };
}

// ── Kasa özeti ────────────────────────────────────────────────

export type LedgerPeriodSummary = LedgerTotals & {
  period: Period;
  /** Gider kırılımı — en büyük kalem başta. */
  expensesByCategory: { category: ExpenseCategory; amountMinor: number }[];
  paymentsByMethod: { method: PaymentMethod; amountMinor: number }[];
  paymentCount: number;
  /** Dönemde tahakkuk eden, henüz ödenmemiş antrenör hakedişi. */
  pendingEarningsMinor: number;
};

/** Salon kasası — yalnız yönetici çağırır. */
export async function getLedgerSummary(
  organizationId: string,
  period: Period,
): Promise<LedgerPeriodSummary> {
  const range = { gte: period.start, lt: period.end };

  const [income, expenses, byCategory, byMethod, pendingEarnings] =
    await Promise.all([
      prisma.payment.aggregate({
        where: { organizationId, paidAt: range },
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId, spentAt: range },
        _sum: { amountMinor: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { organizationId, spentAt: range },
        _sum: { amountMinor: true },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { organizationId, paidAt: range },
        _sum: { amountMinor: true },
      }),
      prisma.coachEarning.aggregate({
        where: { organizationId, status: "tahakkuk", earnedAt: range },
        _sum: { amountMinor: true },
      }),
    ]);

  const incomeMinor = income._sum.amountMinor ?? 0;
  const expenseMinor = expenses._sum.amountMinor ?? 0;

  return {
    ...rollup(incomeMinor, expenseMinor),
    period,
    expensesByCategory: byCategory
      .map((row) => ({
        category: normalizeExpenseCategory(row.category),
        amountMinor: row._sum.amountMinor ?? 0,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
    paymentsByMethod: byMethod
      .map((row) => ({
        method: normalizePaymentMethod(row.method),
        amountMinor: row._sum.amountMinor ?? 0,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
    paymentCount: income._count._all,
    pendingEarningsMinor: pendingEarnings._sum.amountMinor ?? 0,
  };
}

/** Trend çubuğu için: son N dönemin gelir/gider/net değerleri. */
export async function getLedgerTrend(
  organizationId: string,
  periods: Period[],
): Promise<{ period: Period; totals: LedgerTotals }[]> {
  if (periods.length === 0) return [];
  const from = periods[0].start;
  const to = periods[periods.length - 1].end;

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId, paidAt: { gte: from, lt: to } },
      select: { paidAt: true, amountMinor: true },
    }),
    prisma.expense.findMany({
      where: { organizationId, spentAt: { gte: from, lt: to } },
      select: { spentAt: true, amountMinor: true },
    }),
  ]);

  return periods.map((period) => {
    const inRange = (at: Date) => at >= period.start && at < period.end;
    const income = payments
      .filter((row) => inRange(row.paidAt))
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const expense = expenses
      .filter((row) => inRange(row.spentAt))
      .reduce((sum, row) => sum + row.amountMinor, 0);
    return { period, totals: rollup(income, expense) };
  });
}

/**
 * Antrenörün kendi mali ekranı: kendi sporcularından gelen tahsilat + kendi
 * hakedişi. Salon geneli rakam YOK — kullanıcı kararı (bkz. README).
 */
export type CoachFinanceView = {
  period: Period;
  incomeFromMyMembersMinor: number;
  paymentCount: number;
  earning: CoachEarningSummary | null;
  unpaidMembers: {
    memberId: string;
    memberName: string;
    memberNo: string;
    balanceMinor: number;
    endDate: Date;
  }[];
};

export async function getCoachFinanceView(
  scope: StaffScope,
  coachUserId: string,
  period: Period,
): Promise<CoachFinanceView> {
  const [incomeMinor, paymentCount, summaries] = await Promise.all([
    sumPayments(scope, { from: period.start, to: period.end }),
    prisma.payment.count({
      where: {
        organizationId: scope.organizationId,
        member: memberWhere(scope),
        paidAt: { gte: period.start, lt: period.end },
      },
    }),
    getCoachEarningSummaries(scope.organizationId, period, { coachUserId }),
  ]);

  const subscriptions = await prisma.memberSubscription.findMany({
    where: { member: memberWhere(scope), priceMinor: { gt: 0 } },
    orderBy: { endDate: "desc" },
    include: {
      member: { select: { id: true, fullName: true, memberNo: true } },
      payments: { select: { amountMinor: true } },
    },
  });

  const unpaidMembers = subscriptions
    .map((row) => ({
      memberId: row.member.id,
      memberName: row.member.fullName,
      memberNo: row.member.memberNo,
      balanceMinor:
        row.priceMinor -
        row.payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
      endDate: row.endDate,
    }))
    .filter((row) => row.balanceMinor > 0)
    .sort((a, b) => b.balanceMinor - a.balanceMinor);

  return {
    period,
    incomeFromMyMembersMinor: incomeMinor,
    paymentCount,
    earning: summaries[0] ?? null,
    unpaidMembers,
  };
}

/** Sporcunun ödeme geçmişi + açık borcu — sporcu detay sayfası için. */
export async function getMemberFinance(memberId: string) {
  const [payments, subscriptions] = await Promise.all([
    prisma.payment.findMany({
      where: { memberId },
      orderBy: { paidAt: "desc" },
      include: { subscription: { select: { plan: { select: { name: true } } } } },
    }),
    prisma.memberSubscription.findMany({
      where: { memberId },
      orderBy: { endDate: "desc" },
      include: {
        plan: { select: { name: true } },
        payments: { select: { amountMinor: true } },
      },
    }),
  ]);

  return {
    payments: payments.map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      method: normalizePaymentMethod(row.method),
      paidAt: row.paidAt,
      planName: row.subscription?.plan.name ?? null,
      note: row.note,
    })),
    subscriptions: subscriptions.map((row) => ({
      id: row.id,
      planName: row.plan.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      priceMinor: row.priceMinor,
      currency: row.currency,
      paidMinor: row.payments.reduce((sum, p) => sum + p.amountMinor, 0),
    })),
  };
}

/** Şu anki dönem — sayfa parametresi yoksa varsayılan. */
export function currentPeriod(kind: PeriodKind, now: Date = new Date()): Period {
  return periodContaining(kind, now);
}

export type PayableMember = {
  memberId: string;
  memberName: string;
  memberNo: string;
  coachName: string | null;
  subscriptions: {
    id: string;
    planName: string;
    endDate: Date;
    priceMinor: number;
    paidMinor: number;
    balanceMinor: number;
  }[];
  totalBalanceMinor: number;
};

/**
 * Tahsilat formunun sporcu listesi: kapsam içindeki sporcular ve açık
 * üyelikleri. Borcu olan üstte — kasada en çok aranan liste bu.
 */
export async function listPayableMembers(
  scope: StaffScope,
): Promise<PayableMember[]> {
  const members = await prisma.member.findMany({
    where: memberWhere(scope, { status: { in: ["active", "lead"] } }),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      assignedCoach: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
      subscriptions: {
        where: { status: { in: ["aktif", "donduruldu"] } },
        orderBy: { endDate: "desc" },
        select: {
          id: true,
          endDate: true,
          priceMinor: true,
          plan: { select: { name: true } },
          payments: { select: { amountMinor: true } },
        },
      },
    },
  });

  return members
    .map((member) => {
      const subscriptions = member.subscriptions.map((row) => {
        const paidMinor = row.payments.reduce(
          (sum, payment) => sum + payment.amountMinor,
          0,
        );
        return {
          id: row.id,
          planName: row.plan.name,
          endDate: row.endDate,
          priceMinor: row.priceMinor,
          paidMinor,
          balanceMinor: Math.max(0, row.priceMinor - paidMinor),
        };
      });

      return {
        memberId: member.id,
        memberName: member.fullName,
        memberNo: member.memberNo,
        coachName:
          member.assignedCoach?.profile?.displayName ??
          member.assignedCoach?.email ??
          null,
        subscriptions,
        totalBalanceMinor: subscriptions.reduce(
          (sum, row) => sum + row.balanceMinor,
          0,
        ),
      };
    })
    .sort((a, b) => {
      if (b.totalBalanceMinor !== a.totalBalanceMinor) {
        return b.totalBalanceMinor - a.totalBalanceMinor;
      }
      return a.memberName.localeCompare(b.memberName, "tr");
    });
}
