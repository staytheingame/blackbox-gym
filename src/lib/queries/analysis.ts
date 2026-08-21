import "server-only";
import { prisma } from "@/lib/db";
import { analyzeMember, type MemberAnalysis } from "@/domain/analysis/member-analysis";
import { getMembershipCredits } from "@/lib/queries/slots";
import { getNutritionCompliance } from "@/lib/queries/nutrition";

/**
 * Sporcu analizinin veri toplama katmanı — hesap yok, yalnız okuma.
 * Bütün yorum `src/domain/analysis/member-analysis.ts` içinde yapılır;
 * burada tek iş, o saf fonksiyonun istediği kayıtları tek turda getirmek.
 */

export type MemberAnalysisResult = {
  member: {
    id: string;
    fullName: string;
    memberNo: string;
    createdAt: Date;
  };
  analysis: MemberAnalysis;
};

export async function getMemberAnalysis(
  memberId: string,
  organizationId: string,
): Promise<MemberAnalysisResult | null> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, fullName: true, memberNo: true, createdAt: true },
  });
  if (!member) return null;

  const [bookings, trainings, checkIns, weights, activePlan, credits, nutrition] =
    await Promise.all([
      prisma.slotBooking.findMany({
        where: { memberId },
        select: { status: true, slot: { select: { startsAt: true } } },
      }),
      prisma.trainingLog.findMany({
        where: { memberId },
        orderBy: { loggedAt: "desc" },
        take: 200,
        select: { loggedAt: true, durationMinutes: true, intensity: true },
      }),
      prisma.checkIn.findMany({
        where: { memberId },
        orderBy: { weekStart: "desc" },
        take: 26,
        select: { weekStart: true },
      }),
      prisma.weightEntry.findMany({
        where: { memberId },
        orderBy: { takenAt: "asc" },
        take: 60,
        select: { takenAt: true, weightKg: true },
      }),
      prisma.memberPlan.findFirst({
        where: { memberId, status: "aktif" },
        select: {
          startDate: true,
          template: { select: { weeks: true, _count: { select: { days: true } } } },
          _count: { select: { completions: true } },
        },
      }),
      getMembershipCredits(memberId),
      getNutritionCompliance(memberId, 7),
    ]);

  // Program uyumu: plan başladığından bu yana GEÇEN günlerin beklentisi
  // üzerinden. Tüm şablonu beklenti saymak, ilk haftasındaki sporcuyu
  // haksız yere "%8 uyumlu" gösterirdi.
  const planCompletion = activePlan
    ? {
        completed: activePlan._count.completions,
        expected: expectedPlanDays(
          activePlan.startDate,
          activePlan.template.weeks,
          activePlan.template._count.days,
        ),
      }
    : null;

  const analysis = analyzeMember({
    now: new Date(),
    memberSince: member.createdAt,
    attendance: bookings.map((row) => ({
      startsAt: row.slot.startsAt,
      status: row.status,
    })),
    trainings,
    checkIns,
    weights,
    planCompletion,
    nutritionPercent:
      nutrition.confidence === "yok" ? null : nutrition.percent,
    nutritionConfidence: nutrition.confidence,
    membership: credits
      ? {
          endDate: credits.endDate,
          daysLeft: credits.daysLeft,
          sessionsRemaining: credits.remaining,
          unlimited: credits.unlimited,
        }
      : null,
  });

  return { member, analysis };
}

/** Plan başlangıcından bugüne düşen gün sayısı — şablon uzunluğunu aşmaz. */
function expectedPlanDays(
  startDate: Date,
  weeks: number,
  totalDays: number,
): number {
  if (totalDays === 0 || weeks === 0) return 0;

  const weeksElapsed = Math.max(
    1,
    Math.ceil((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  const daysPerWeek = totalDays / weeks;
  return Math.round(Math.min(weeksElapsed, weeks) * daysPerWeek);
}

export type OccupancyReport = {
  /** Rapor penceresi (gün). */
  days: number;
  totalSlots: number;
  bookedSeats: number;
  capacity: number;
  /** Açılan kontenjanın yüzde kaçı doldu. */
  fillRate: number;
  attended: number;
  noShow: number;
  showRate: number;
  /** Saat başına doluluk — hangi saatler tutuyor. */
  byHour: { hour: number; slots: number; seats: number }[];
  /** Gün bazında doluluk — 1 = Pazartesi. */
  byWeekday: { weekday: number; slots: number; seats: number }[];
};

/**
 * Salon doluluk raporu — yöneticinin "hangi saatler tutuyor, açtığımız
 * saatlerin kaçı doluyor" sorusu.
 */
export async function getOccupancyReport(
  organizationId: string,
  days = 30,
): Promise<OccupancyReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const slots = await prisma.trainingSlot.findMany({
    where: {
      organizationId,
      startsAt: { gte: since, lte: new Date() },
      status: { not: "iptal" },
    },
    select: {
      startsAt: true,
      capacity: true,
      bookings: { select: { status: true } },
    },
  });

  const byHour = new Map<number, { slots: number; seats: number }>();
  const byWeekday = new Map<number, { slots: number; seats: number }>();

  let bookedSeats = 0;
  let capacity = 0;
  let attended = 0;
  let noShow = 0;

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hourCycle: "h23",
  });

  for (const slot of slots) {
    const seats = slot.bookings.filter((booking) =>
      ["onayli", "katildi", "gelmedi"].includes(booking.status),
    ).length;

    bookedSeats += seats;
    capacity += slot.capacity;
    attended += slot.bookings.filter((b) => b.status === "katildi").length;
    noShow += slot.bookings.filter((b) => b.status === "gelmedi").length;

    const hour = Number(hourFormatter.format(slot.startsAt));
    const hourRow = byHour.get(hour) ?? { slots: 0, seats: 0 };
    hourRow.slots += 1;
    hourRow.seats += seats;
    byHour.set(hour, hourRow);

    const weekday = gymWeekday(slot.startsAt);
    const dayRow = byWeekday.get(weekday) ?? { slots: 0, seats: 0 };
    dayRow.slots += 1;
    dayRow.seats += seats;
    byWeekday.set(weekday, dayRow);
  }

  const settled = attended + noShow;

  return {
    days,
    totalSlots: slots.length,
    bookedSeats,
    capacity,
    fillRate: capacity === 0 ? 0 : Math.round((bookedSeats / capacity) * 100),
    attended,
    noShow,
    showRate: settled === 0 ? 0 : Math.round((attended / settled) * 100),
    byHour: [...byHour.entries()]
      .map(([hour, row]) => ({ hour, ...row }))
      .sort((a, b) => a.hour - b.hour),
    byWeekday: [...byWeekday.entries()]
      .map(([weekday, row]) => ({ weekday, ...row }))
      .sort((a, b) => a.weekday - b.weekday),
  };
}

function gymWeekday(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[parts] ?? 1;
}
