import "server-only";
import { prisma } from "@/lib/db";
import { normalizeRole, type OrgRole } from "@/lib/auth/roles";
import { organizationScope } from "@/lib/auth/scope";
import {
  compareCoachPriority,
  evaluateCoachScorecard,
  portfolioBalance,
  type CoachScorecard,
} from "@/domain/coaching/coach-scorecard";
import type { Period } from "@/domain/finance/period";
import { toCompensation } from "@/lib/queries/finance";
import {
  getMemberRadarBoard,
  groupRadarByCoach,
  type MemberRadarRow,
} from "@/lib/queries/radar";

/**
 * KOÇ TAKİBİ — "kadro nasıl gidiyor" sorusunun sorgu katmanı.
 *
 * Hakediş tarafı `finance.ts`'te durur ve orada kalır (para ayrı bir konu).
 * Burada ölçülen şey **iş**: kim kaç ders verdi, masasında ne birikti,
 * portföyünün radar dağılımı ne.
 *
 * Kapsam notu: bu ekranlar yalnız yöneticiye açıktır (`requireAdmin`),
 * `coachUserId` verilerek antrenörün kendi karnesi için de çağrılabilir.
 * Antrenör kendi karnesini görürken salon geneli sayılar görünmez —
 * çağıran sayfa filtreyi geçirir.
 */

export type CoachScoreRow = {
  coachUserId: string;
  displayName: string;
  email: string;
  role: OrgRole;
  isActive: boolean;
  joinedAt: Date;

  /** Sorumlusu olduğu sporcular. */
  portfolio: number;
  activeMembers: number;
  criticalMembers: number;
  watchMembers: number;
  quietMembers: number;

  /** Dönem sayıları — yalnız BAŞLAMIŞ seanslar (gelecek saatler hariç). */
  slotsOpened: number;
  capacityOffered: number;
  seatsBooked: number;
  sessionsHeld: number;
  seatsAttended: number;
  seatsNoShow: number;
  upcomingSlots: number;

  /** Birikmiş iş — dönemden bağımsız, "şu an" duruyor. */
  attendanceBacklog: number;
  checkInBacklog: number;

  /** Sözleşme. */
  monthlySessionQuota: number | null;
  hasCompensation: boolean;

  /** Dönemde bu antrenörün sporcularından tahsil edilen (kuruş). */
  collectedMinor: number;

  scorecard: CoachScorecard;
};

export type CoachScoreboard = {
  period: Period;
  rows: CoachScoreRow[];
  /** Portföy dağılımı — bir antrenörde yığılma varsa burada görünür. */
  balance: ReturnType<typeof portfolioBalance>;
  /** Hiçbir antrenöre atanmamış sporcu sayısı. */
  unassignedMembers: number;
  /** Salon geneli birikmiş iş toplamı. */
  totalAttendanceBacklog: number;
  totalCheckInBacklog: number;
};

type StaffRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  isActive: boolean;
  joinedAt: Date;
  monthlySessionQuota: number | null;
  hasCompensation: boolean;
};

/** Kadroyu hakediş ayarıyla birlikte okur — antrenör başına ayrı sorgu yok. */
async function listStaffRecords(
  organizationId: string,
  coachUserId?: string,
): Promise<StaffRecord[]> {
  const rows = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      role: { in: ["coach", "admin", "staff"] },
      ...(coachUserId ? { userId: coachUserId } : {}),
    },
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

  return rows.map((row) => {
    const compensation = toCompensation(row.user.compensation);
    return {
      userId: row.user.id,
      email: row.user.email,
      displayName: row.user.profile?.displayName ?? row.user.email,
      role: normalizeRole(row.role),
      isActive: row.status === "active",
      joinedAt: row.createdAt,
      monthlySessionQuota: compensation.monthlySessionQuota,
      hasCompensation: compensation.model !== "yok",
    };
  });
}

type SlotFacts = {
  slotsOpened: Map<string, number>;
  capacityOffered: Map<string, number>;
  seatsBooked: Map<string, number>;
  sessionsHeld: Map<string, number>;
  seatsAttended: Map<string, number>;
  seatsNoShow: Map<string, number>;
};

const SEAT_STATUSES = new Set(["onayli", "katildi", "gelmedi"]);

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/**
 * Dönemdeki seansların antrenör kırılımı. Tek `findMany` ile çekilip
 * bellekte sayılır; `groupBy` üç ayrı sorgu gerektirirdi ve yine de
 * "yoklaması alınmış seans" ayrımını veremezdi.
 *
 * **Yalnız BAŞLAMIŞ seanslar sayılır.** İçinde bulunulan ay için dönem sonu
 * gelecekte kalır; henüz gelmemiş saatler doğal olarak boştur ve hesaba
 * katılırsa doluluk yapay biçimde düşer ("ayın 3'ünde %10 doluluk" gibi).
 * Gelecekteki saatler ayrı bir sayıdır — bkz. `collectUpcomingSlots`.
 */
async function collectSlotFacts(
  organizationId: string,
  period: Period,
  now: Date,
  coachUserId?: string,
): Promise<SlotFacts> {
  const until = period.end < now ? period.end : now;

  const slots = await prisma.trainingSlot.findMany({
    where: {
      organizationId,
      startsAt: { gte: period.start, lt: until },
      status: { not: "iptal" },
      ...(coachUserId ? { coachUserId } : {}),
    },
    select: {
      coachUserId: true,
      capacity: true,
      bookings: { select: { status: true } },
    },
  });

  const facts: SlotFacts = {
    slotsOpened: new Map(),
    capacityOffered: new Map(),
    seatsBooked: new Map(),
    sessionsHeld: new Map(),
    seatsAttended: new Map(),
    seatsNoShow: new Map(),
  };

  for (const slot of slots) {
    const coach = slot.coachUserId;
    bump(facts.slotsOpened, coach);
    bump(facts.capacityOffered, coach, slot.capacity);

    let settledSeats = 0;
    for (const booking of slot.bookings) {
      if (SEAT_STATUSES.has(booking.status)) bump(facts.seatsBooked, coach);
      if (booking.status === "katildi") {
        bump(facts.seatsAttended, coach);
        settledSeats += 1;
      }
      if (booking.status === "gelmedi") {
        bump(facts.seatsNoShow, coach);
        settledSeats += 1;
      }
    }
    // "Verilen ders" = yoklaması alınmış seans. Hakediş de bu tanıma bakar
    // (bkz. `getCoachEarningSummaries`), iki ekran aynı sayıyı göstersin.
    if (settledSeats > 0) bump(facts.sessionsHeld, coach);
  }

  return facts;
}

/** Yoklaması alınmamış geçmiş seanslar — antrenör başına birikmiş iş. */
async function collectAttendanceBacklog(
  organizationId: string,
  now: Date,
  coachUserId?: string,
): Promise<Map<string, number>> {
  const slots = await prisma.trainingSlot.findMany({
    where: {
      organizationId,
      status: "acik",
      startsAt: { lt: now },
      bookings: { some: { status: "onayli" } },
      ...(coachUserId ? { coachUserId } : {}),
    },
    select: { coachUserId: true },
  });

  const backlog = new Map<string, number>();
  for (const slot of slots) bump(backlog, slot.coachUserId);
  return backlog;
}

/**
 * İncelenmemiş haftalık kontroller — sporcunun sorumlu antrenörüne yazılır.
 * Antrenörü olmayan sporcunun kontrolü kimsenin kuyruğunda görünmez;
 * bu, radardaki `antrenorsuz` sinyalinin işidir.
 */
async function collectCheckInBacklog(
  organizationId: string,
  coachUserId?: string,
): Promise<Map<string, number>> {
  const rows = await prisma.checkIn.groupBy({
    by: ["memberId"],
    where: {
      status: "submitted",
      member: {
        organizationId,
        ...(coachUserId ? { assignedCoachUserId: coachUserId } : {}),
      },
    },
    _count: { memberId: true },
  });
  if (rows.length === 0) return new Map();

  const members = await prisma.member.findMany({
    where: { id: { in: rows.map((row) => row.memberId) } },
    select: { id: true, assignedCoachUserId: true },
  });
  const coachByMember = new Map(
    members.map((member) => [member.id, member.assignedCoachUserId]),
  );

  const backlog = new Map<string, number>();
  for (const row of rows) {
    const coach = coachByMember.get(row.memberId);
    if (!coach) continue;
    bump(backlog, coach, row._count.memberId);
  }
  return backlog;
}

/** Dönemde antrenörün sporcularından tahsil edilen tutar (kuruş). */
async function collectCollections(
  organizationId: string,
  period: Period,
  coachUserId?: string,
): Promise<Map<string, number>> {
  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      paidAt: { gte: period.start, lt: period.end },
      member: {
        assignedCoachUserId: coachUserId ? coachUserId : { not: null },
      },
    },
    select: {
      amountMinor: true,
      member: { select: { assignedCoachUserId: true } },
    },
  });

  const totals = new Map<string, number>();
  for (const payment of payments) {
    const coach = payment.member.assignedCoachUserId;
    if (!coach) continue;
    bump(totals, coach, payment.amountMinor);
  }
  return totals;
}

/** Antrenörün açtığı, henüz geçmemiş seans sayısı. */
async function collectUpcomingSlots(
  organizationId: string,
  now: Date,
  coachUserId?: string,
): Promise<Map<string, number>> {
  const rows = await prisma.trainingSlot.groupBy({
    by: ["coachUserId"],
    where: {
      organizationId,
      status: "acik",
      startsAt: { gte: now },
      ...(coachUserId ? { coachUserId } : {}),
    },
    _count: { coachUserId: true },
  });

  return new Map(rows.map((row) => [row.coachUserId, row._count.coachUserId]));
}

export type CoachScoreboardOptions = {
  /** Yalnız bu antrenör — antrenörün kendi karnesi için. */
  coachUserId?: string;
  now?: Date;
  /** Radar satırları dışarıda hesaplandıysa yeniden çekilmesin. */
  radarRows?: readonly MemberRadarRow[];
};

/**
 * Kadro karnesi. Radar satırları paylaşılır: aynı istekte hem sporcu
 * radarı hem koç karnesi gerekiyorsa `radarRows` geçilerek ikinci tarama
 * önlenir.
 */
export async function getCoachScoreboard(
  organizationId: string,
  period: Period,
  { coachUserId, now = new Date(), radarRows }: CoachScoreboardOptions = {},
): Promise<CoachScoreboard> {
  const scope = organizationScope(organizationId);

  const [staff, rows, slotFacts, attendanceBacklog, checkInBacklog, collections, upcoming] =
    await Promise.all([
      listStaffRecords(organizationId, coachUserId),
      radarRows
        ? Promise.resolve(radarRows)
        : getMemberRadarBoard(scope, { now }).then((board) => board.rows),
      collectSlotFacts(organizationId, period, now, coachUserId),
      collectAttendanceBacklog(organizationId, now, coachUserId),
      collectCheckInBacklog(organizationId, coachUserId),
      collectCollections(organizationId, period, coachUserId),
      collectUpcomingSlots(organizationId, now, coachUserId),
    ]);

  const byCoach = groupRadarByCoach(rows);

  // Portföy sayısı radardan DEĞİL, doğrudan tablodan gelir: radar yalnız
  // `active` sporcuları tarar, sorumluluk ise pasif kayıtta da sürer.
  const portfolioRows = await prisma.member.groupBy({
    by: ["assignedCoachUserId"],
    where: { organizationId },
    _count: { assignedCoachUserId: true },
  });
  const portfolioByCoach = new Map(
    portfolioRows
      .filter((row) => row.assignedCoachUserId !== null)
      .map((row) => [
        row.assignedCoachUserId as string,
        row._count.assignedCoachUserId,
      ]),
  );

  const scoreRows: CoachScoreRow[] = staff.map((record) => {
    const radar = byCoach.get(record.userId);
    const input = {
      portfolio: portfolioByCoach.get(record.userId) ?? 0,
      activeMembers: radar?.total ?? 0,
      criticalMembers: radar?.critical ?? 0,
      watchMembers: radar?.watch ?? 0,
      quietMembers: radar?.quiet ?? 0,
      slotsOpened: slotFacts.slotsOpened.get(record.userId) ?? 0,
      capacityOffered: slotFacts.capacityOffered.get(record.userId) ?? 0,
      seatsBooked: slotFacts.seatsBooked.get(record.userId) ?? 0,
      sessionsHeld: slotFacts.sessionsHeld.get(record.userId) ?? 0,
      seatsAttended: slotFacts.seatsAttended.get(record.userId) ?? 0,
      seatsNoShow: slotFacts.seatsNoShow.get(record.userId) ?? 0,
      attendanceBacklog: attendanceBacklog.get(record.userId) ?? 0,
      checkInBacklog: checkInBacklog.get(record.userId) ?? 0,
      monthlySessionQuota: record.monthlySessionQuota,
      hasCompensation: record.hasCompensation,
      isActive: record.isActive,
    };

    return {
      ...input,
      coachUserId: record.userId,
      displayName: record.displayName,
      email: record.email,
      role: record.role,
      joinedAt: record.joinedAt,
      upcomingSlots: upcoming.get(record.userId) ?? 0,
      collectedMinor: collections.get(record.userId) ?? 0,
      scorecard: evaluateCoachScorecard(input),
    };
  });

  scoreRows.sort((a, b) =>
    compareCoachPriority(
      { backlogScore: a.scorecard.backlogScore, portfolio: a.portfolio },
      { backlogScore: b.scorecard.backlogScore, portfolio: b.portfolio },
    ),
  );

  return {
    period,
    rows: scoreRows,
    balance: portfolioBalance(scoreRows.filter((row) => row.isActive)),
    unassignedMembers: byCoach.get(null)?.total ?? 0,
    totalAttendanceBacklog: scoreRows.reduce(
      (total, row) => total + row.attendanceBacklog,
      0,
    ),
    totalCheckInBacklog: scoreRows.reduce(
      (total, row) => total + row.checkInBacklog,
      0,
    ),
  };
}

export type CoachDetail = {
  row: CoachScoreRow;
  /** Sorumlu olduğu sporcuların radar satırları — en acil üstte. */
  members: MemberRadarRow[];
};

/**
 * Tek antrenörün karnesi + portföyünün radar dökümü. Yönetici kadro
 * ekranından, antrenör de kendi "Karnem" ekranından bunu açar.
 */
export async function getCoachDetail(
  organizationId: string,
  coachUserId: string,
  period: Period,
  { now = new Date() }: { now?: Date } = {},
): Promise<CoachDetail | null> {
  // Radar doğrudan bu antrenörün kapsamıyla taranır: başka antrenörün
  // sporcusu belleğe bile alınmaz (bkz. `src/lib/auth/scope.ts` kuralı).
  const board = await getMemberRadarBoard(
    { organizationId, coachUserId },
    { now },
  );

  const scoreboard = await getCoachScoreboard(organizationId, period, {
    coachUserId,
    now,
    radarRows: board.rows,
  });

  const row = scoreboard.rows.find((item) => item.coachUserId === coachUserId);
  if (!row) return null;

  return { row, members: board.rows };
}
