import "server-only";
import { prisma } from "@/lib/db";
import { normalizeRole, type OrgRole } from "@/lib/auth/roles";
import { getWeekStartInstant } from "@/lib/date";

/**
 * Yönetici paneli sorguları — salonun işletme katmanı.
 *
 * Antrenör sorguları (`staff.ts`) "bu sporcu nasıl gidiyor" sorusuna bakar;
 * buradakiler "salon nasıl gidiyor" sorusuna: kadro, paket tanımları,
 * bildirim akışı, doluluk.
 *
 * Kadroya ekleme burada DEĞİL: personel hesabı davet bağlantısıyla açılır,
 * şifresini kişi kendi kurar (bkz. `staff-invites.ts`).
 */

export type StaffRow = {
  organizationUserId: string;
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: string;
  createdAt: Date;
  /** Bu antrenörün açtığı, henüz geçmemiş seans sayısı. */
  upcomingSlots: number;
};

export async function listStaff(organizationId: string): Promise<StaffRow[]> {
  const rows = await prisma.organizationUser.findMany({
    where: { organizationId, role: { in: ["coach", "admin", "staff"] } },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  const slotCounts = await prisma.trainingSlot.groupBy({
    by: ["coachUserId"],
    where: {
      organizationId,
      startsAt: { gte: new Date() },
      status: "acik",
    },
    _count: { coachUserId: true },
  });

  const byCoach = new Map(
    slotCounts.map((row) => [row.coachUserId, row._count.coachUserId]),
  );

  return rows.map((row) => ({
    organizationUserId: row.id,
    userId: row.user.id,
    email: row.user.email,
    displayName: row.user.profile?.displayName ?? row.user.email,
    role: normalizeRole(row.role),
    status: row.status,
    createdAt: row.createdAt,
    upcomingSlots: byCoach.get(row.user.id) ?? 0,
  }));
}

export type ChangeRoleResult = { ok: boolean; error?: string };

/**
 * Rol değiştirir. Salonun SON yöneticisi rolünü bırakamaz — kimsenin
 * giremediği bir yönetim paneli, kurtarılması elle müdahale gerektiren
 * bir arıza olurdu.
 */
export async function changeStaffRole(
  organizationUserId: string,
  organizationId: string,
  role: OrgRole,
): Promise<ChangeRoleResult> {
  const target = await prisma.organizationUser.findFirst({
    where: { id: organizationUserId, organizationId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "Kayıt bulunamadı." };

  if (normalizeRole(target.role) === "admin" && role !== "admin") {
    const adminCount = await prisma.organizationUser.count({
      where: { organizationId, role: "admin", status: "active" },
    });
    if (adminCount <= 1) {
      return {
        ok: false,
        error: "Salonun tek yöneticisi bu — önce başka bir yönetici ata.",
      };
    }
  }

  await prisma.organizationUser.update({
    where: { id: target.id },
    data: { role },
  });

  return { ok: true };
}

/** Hesabı kapatır/açar. Son aktif yönetici kapatılamaz. */
export async function setStaffStatus(
  organizationUserId: string,
  organizationId: string,
  status: "active" | "disabled",
): Promise<ChangeRoleResult> {
  const target = await prisma.organizationUser.findFirst({
    where: { id: organizationUserId, organizationId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "Kayıt bulunamadı." };

  if (status === "disabled" && normalizeRole(target.role) === "admin") {
    const adminCount = await prisma.organizationUser.count({
      where: { organizationId, role: "admin", status: "active" },
    });
    if (adminCount <= 1) {
      return { ok: false, error: "Son aktif yönetici kapatılamaz." };
    }
  }

  await prisma.organizationUser.update({
    where: { id: target.id },
    data: { status },
  });

  return { ok: true };
}

// ── Paket tanımları ───────────────────────────────────────────

export type SavePlanInput = {
  name: string;
  description: string | null;
  priceMinor: number;
  durationDays: number;
  /** `null` = sınırsız ders. */
  totalSessions: number | null;
  isActive: boolean;
};

export async function createMembershipPlan(
  organizationId: string,
  input: SavePlanInput,
): Promise<string> {
  const plan = await prisma.membershipPlan.create({
    data: { organizationId, ...input },
    select: { id: true },
  });
  return plan.id;
}

export async function updateMembershipPlan(
  planId: string,
  organizationId: string,
  input: Partial<SavePlanInput>,
): Promise<boolean> {
  const result = await prisma.membershipPlan.updateMany({
    where: { id: planId, organizationId },
    data: input,
  });
  return result.count > 0;
}

/**
 * Paketi satıştan kaldırır. SİLMEZ: geçmiş abonelikler pakete bağlı,
 * silmek kayıt geçmişini bozardı.
 */
export async function archiveMembershipPlan(
  planId: string,
  organizationId: string,
): Promise<boolean> {
  return updateMembershipPlan(planId, organizationId, { isActive: false });
}

// ── Salon geneli özet ─────────────────────────────────────────

export type AdminOverview = {
  organizationName: string;
  memberCount: number;
  activeMemberCount: number;
  leadCount: number;
  /** Hesabını kurmamış sporcu. */
  pendingInviteCount: number;
  staffCount: number;
  coachCount: number;
  activeSubscriptions: number;
  expiringSoon: number;
  planCount: number;
  activePlanCount: number;
  slotsThisWeek: number;
  bookingsThisWeek: number;
  notificationsLast7Days: number;
  nutritionPlanCount: number;
};

export async function getAdminOverview(
  organizationId: string,
): Promise<AdminOverview> {
  const now = new Date();
  const weekStart = getWeekStartInstant(now);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    organization,
    memberCount,
    activeMemberCount,
    leadCount,
    pendingInviteCount,
    staffRows,
    activeSubscriptions,
    expiringSoon,
    planCount,
    activePlanCount,
    slotsThisWeek,
    bookingsThisWeek,
    notificationsLast7Days,
    nutritionPlanCount,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.member.count({ where: { organizationId } }),
    prisma.member.count({ where: { organizationId, status: "active" } }),
    prisma.member.count({ where: { organizationId, status: "lead" } }),
    prisma.member.count({ where: { organizationId, userId: null } }),
    prisma.organizationUser.groupBy({
      by: ["role"],
      where: { organizationId, status: "active" },
      _count: { role: true },
    }),
    prisma.memberSubscription.count({
      where: { member: { organizationId }, status: "aktif", endDate: { gte: now } },
    }),
    prisma.memberSubscription.count({
      where: {
        member: { organizationId },
        status: "aktif",
        endDate: { gte: now, lte: in14Days },
      },
    }),
    prisma.membershipPlan.count({ where: { organizationId } }),
    prisma.membershipPlan.count({ where: { organizationId, isActive: true } }),
    prisma.trainingSlot.count({
      where: { organizationId, startsAt: { gte: weekStart } },
    }),
    prisma.slotBooking.count({
      where: {
        slot: { organizationId, startsAt: { gte: weekStart } },
        status: { in: ["onayli", "katildi", "gelmedi"] },
      },
    }),
    prisma.notification.count({
      where: { organizationId, createdAt: { gte: last7Days } },
    }),
    prisma.nutritionPlan.count({ where: { organizationId, status: "aktif" } }),
  ]);

  const roleCounts = new Map(
    staffRows.map((row) => [normalizeRole(row.role), row._count.role]),
  );

  return {
    organizationName: organization?.name ?? "Salon",
    memberCount,
    activeMemberCount,
    leadCount,
    pendingInviteCount,
    staffCount: (roleCounts.get("coach") ?? 0) + (roleCounts.get("admin") ?? 0),
    coachCount: roleCounts.get("coach") ?? 0,
    activeSubscriptions,
    expiringSoon,
    planCount,
    activePlanCount,
    slotsThisWeek,
    bookingsThisWeek,
    notificationsLast7Days,
    nutritionPlanCount,
  };
}

// ── Sporcu ↔ antrenör bağı ────────────────────────────────────

export type CoachOption = {
  userId: string;
  displayName: string;
  role: OrgRole;
  /** Sorumlusu olduğu sporcu sayısı — yük dağılımı görünsün. */
  memberCount: number;
};

/**
 * Sporcuya atanabilecek kişiler: aktif antrenörler ve yöneticiler.
 * (Salon sahibi çoğu zaman kendisi de ders veriyor — bkz. `lib/auth/roles.ts`.)
 */
export async function listCoaches(
  organizationId: string,
): Promise<CoachOption[]> {
  const rows = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      status: "active",
      role: { in: ["coach", "admin", "staff"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
          _count: { select: { coachedMembers: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    userId: row.user.id,
    displayName: row.user.profile?.displayName ?? row.user.email,
    role: normalizeRole(row.role),
    memberCount: row.user._count.coachedMembers,
  }));
}

/**
 * Sporcunun sorumlu antrenörünü değiştirir (devir). `coachUserId = null`
 * atamayı kaldırır — sporcu o andan sonra hiçbir antrenörün listesinde
 * çıkmaz, yalnız yönetici görür.
 */
export async function assignCoach(
  organizationId: string,
  memberId: string,
  coachUserId: string | null,
): Promise<{ ok: true; memberName: string } | { ok: false; error: string }> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, fullName: true },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };

  if (coachUserId) {
    const staff = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        userId: coachUserId,
        status: "active",
        role: { in: ["coach", "admin", "staff"] },
      },
      select: { id: true },
    });
    if (!staff) {
      return { ok: false, error: "Seçilen kişi salonun aktif kadrosunda değil." };
    }
  }

  await prisma.member.update({
    where: { id: member.id },
    data: { assignedCoachUserId: coachUserId },
  });

  return { ok: true, memberName: member.fullName };
}
