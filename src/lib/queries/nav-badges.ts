import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/date";
import type { BadgeKey } from "@/config/panel-nav";
import { organizationScope, type StaffScope } from "@/lib/auth/scope";
import { countPendingCheckIns } from "@/lib/queries/staff";
import {
  countPendingBookings,
  countSlotsNeedingAttendance,
} from "@/lib/queries/slots";
import { countUnread } from "@/lib/queries/notifications";
import { countPendingInvites } from "@/lib/queries/invites";
import {
  countMembersWithPendingWaivers,
  countPendingWaiversForMember,
} from "@/lib/queries/waivers";
import { countRankReady } from "@/lib/queries/ranks";
import { countUnassignedSelfRegistered } from "@/lib/queries/join-links";
import { countNewLeads } from "@/lib/queries/funnel";

export type NavBadges = Partial<Record<BadgeKey, number>>;

/**
 * Menü rozetleri — YALNIZCA "senden bir şey bekleniyor" sayıları
 * (Kong Academy'nin `nav-badges.ts` kuralı). Günlük sayaçlar bilerek rozet
 * değil: gürültü yaratıyordu.
 */
export async function fetchStaffBadges(
  scope: StaffScope,
  userId: string,
): Promise<NavBadges> {
  const [
    pendingCheckIns,
    pendingBookings,
    pendingAttendance,
    pendingInvites,
    unreadNotifications,
    pendingWaivers,
    rankReady,
    newLeads,
  ] = await Promise.all([
    countPendingCheckIns(scope),
    countPendingBookings(scope),
    countSlotsNeedingAttendance(scope),
    countPendingInvites(scope),
    countUnread(userId),
    countMembersWithPendingWaivers(scope),
    countRankReady(scope),
    countNewLeads(scope.organizationId),
  ]);

  return {
    newLeads,
    pendingCheckIns,
    pendingBookings,
    pendingAttendance,
    pendingInvites,
    unreadNotifications,
    pendingWaivers,
    rankReady,
    // Mesajlaşma veri modeli henüz yok — bkz. BACKLOG.md.
    unreadMessages: 0,
  };
}

export async function fetchMemberBadges(
  memberId: string,
  userId: string,
  organizationId: string,
): Promise<NavBadges> {
  const weekStart = getWeekStart(new Date());

  const [submitted, unreadNotifications, waiverDue] = await Promise.all([
    prisma.checkIn.findUnique({
      where: { memberId_weekStart: { memberId, weekStart } },
      select: { id: true },
    }),
    countUnread(userId),
    countPendingWaiversForMember(memberId, organizationId),
  ]);

  return {
    checkInDue: submitted ? 0 : 1,
    unreadNotifications,
    waiverDue,
    unreadMessages: 0,
  };
}

/** Yönetici panelinin rozetleri — salon geneli. */
export async function fetchAdminBadges(
  organizationId: string,
  userId: string,
): Promise<NavBadges> {
  const [pendingInvites, unreadNotifications, unassignedRegistrations] =
    await Promise.all([
      countPendingInvites(organizationScope(organizationId)),
      countUnread(userId),
      countUnassignedSelfRegistered(organizationId),
    ]);

  return { pendingInvites, unreadNotifications, unassignedRegistrations };
}
