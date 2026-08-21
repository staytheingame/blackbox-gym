import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/date";
import type { BadgeKey } from "@/config/panel-nav";
import { countPendingCheckIns } from "@/lib/queries/staff";
import {
  countPendingBookings,
  countSlotsNeedingAttendance,
} from "@/lib/queries/slots";

export type NavBadges = Partial<Record<BadgeKey, number>>;

/**
 * Menü rozetleri — YALNIZCA "senden bir şey bekleniyor" sayıları
 * (Kong Academy'nin `nav-badges.ts` kuralı). Günlük sayaçlar bilerek rozet
 * değil: gürültü yaratıyordu.
 */
export async function fetchStaffBadges(
  organizationId: string,
): Promise<NavBadges> {
  const [pendingCheckIns, pendingBookings, pendingAttendance] =
    await Promise.all([
      countPendingCheckIns(organizationId),
      countPendingBookings(organizationId),
      countSlotsNeedingAttendance(organizationId),
    ]);

  return {
    pendingCheckIns,
    pendingBookings,
    pendingAttendance,
    // Mesajlaşma veri modeli henüz yok — bkz. BACKLOG.md.
    unreadMessages: 0,
  };
}

export async function fetchMemberBadges(memberId: string): Promise<NavBadges> {
  const weekStart = getWeekStart(new Date());
  const submitted = await prisma.checkIn.findUnique({
    where: { memberId_weekStart: { memberId, weekStart } },
    select: { id: true },
  });

  return {
    checkInDue: submitted ? 0 : 1,
    unreadMessages: 0,
  };
}
