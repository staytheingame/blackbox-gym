"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireStaffScopeForMember,
} from "@/lib/auth/guards";
import {
  SUBSCRIPTION_STATUSES,
  closeExpiredSubscriptions,
  findSubscriptionInOrganization,
  setSubscriptionStatus,
  startOrRenewSubscription,
  type SubscriptionStatus,
} from "@/lib/queries/memberships";
import { formatDateTR } from "@/lib/date";

function revalidateMembershipViews(memberId?: string) {
  revalidatePath("/personel/uyelikler");
  revalidatePath("/personel");
  revalidatePath("/uye/uyelik");
  revalidatePath("/uye/program");
  if (memberId) revalidatePath(`/personel/uyeler/${memberId}`);
}

const createSchema = z.object({
  memberId: z.string().min(1, "Sporcu seçilmedi."),
  planId: z.string().min(1, "Paket seçilmedi."),
  note: z.string().max(200).optional(),
});

export type SubscriptionFormState = { error?: string; success?: string };

/** Üyelik başlat / yenile. Yenilemede yeni dönem eskisi bitince başlar. */
export async function startSubscriptionAction(
  _prevState: SubscriptionFormState,
  formData: FormData,
): Promise<SubscriptionFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = createSchema.safeParse({
    memberId: formData.get("memberId"),
    planId: formData.get("planId"),
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const member = await requireStaffScopeForMember(
    membership.organizationId,
    parsed.data.memberId,
  );

  const result = await startOrRenewSubscription(member.id, parsed.data.planId, {
    note: parsed.data.note,
  });
  if (!result.ok) return { error: result.error };

  revalidateMembershipViews(member.id);
  return {
    success: `${member.fullName} · ${result.renewed ? "yenilendi" : "başlatıldı"}: ${formatDateTR(result.startDate)} – ${formatDateTR(result.endDate)}`,
  };
}

/** Dondur / devam ettir / iptal et. */
export async function changeSubscriptionStatusAction(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;
  if (!SUBSCRIPTION_STATUSES.includes(status)) return;

  const subscription = await findSubscriptionInOrganization(
    subscriptionId,
    membership.organizationId,
  );
  if (!subscription) return;

  await setSubscriptionStatus(subscription.id, status);
  revalidateMembershipViews(subscription.memberId);
}

/**
 * Süresi dolmuş üyelikleri toplu kapatır. Zamanlanmış iş kurulduğunda aynı
 * sorguyu (`closeExpiredSubscriptions`) o çağıracak; şimdilik elle.
 */
export async function closeExpiredAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await closeExpiredSubscriptions(membership.organizationId);
  revalidateMembershipViews();
}
