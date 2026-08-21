"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireMemberInScope,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { reviewCheckIn } from "@/lib/queries/staff";

/**
 * Check-in'i "incelendi" işaretler. Hem üye detayından hem de
 * `/personel/check-inler` kuyruğundan çağrıldığı için panel kökünde durur.
 */
export async function reviewCheckInAction(
  checkInId: string,
  memberId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await requireMemberInScope(
    staffScopeFor(membership, user.id),
    memberId);
  await reviewCheckIn(checkInId, user.id);

  // Detay sayfası, inceleme kuyruğu ve menü rozeti aynı sayıdan besleniyor.
  revalidatePath(`/personel/uyeler/${memberId}`);
  revalidatePath("/personel/check-inler");
  revalidatePath("/personel");
}
