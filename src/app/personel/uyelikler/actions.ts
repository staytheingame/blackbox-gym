"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireMemberInScope,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  SUBSCRIPTION_STATUSES,
  closeExpiredSubscriptions,
  findSubscriptionInOrganization,
  setSubscriptionStatus,
  startOrRenewSubscription,
  type SubscriptionStatus,
} from "@/lib/queries/memberships";
import { formatDateTR } from "@/lib/date";
import { recordAudit } from "@/lib/queries/audit";
import { recordPayment } from "@/lib/queries/finance";
import { normalizePaymentMethod } from "@/domain/finance/ledger";
import { formatMinorTR, parseAmountToMinor } from "@/domain/finance/money";

function revalidateMembershipViews(memberId?: string) {
  revalidatePath("/personel/uyelikler");
  revalidatePath("/personel");
  revalidatePath("/uye/uyelik");
  revalidatePath("/uye/program");
  revalidatePath("/personel/kasa");
  revalidatePath("/yonetim/muhasebe");
  revalidatePath("/yonetim/muhasebe/tahsilat");
  if (memberId) revalidatePath(`/personel/uyeler/${memberId}`);
}

const createSchema = z.object({
  memberId: z.string().min(1, "Sporcu seçilmedi."),
  planId: z.string().min(1, "Paket seçilmedi."),
  note: z.string().max(200).optional(),
  /** Anlaşılan tutar (lira metni). Boşsa paketin etiket fiyatı geçerlidir. */
  price: z.string().max(20).optional(),
  /** Şimdi alınan peşinat/tam ödeme (lira metni). Boşsa tahsilat yazılmaz. */
  paid: z.string().max(20).optional(),
  method: z.string().max(20).optional(),
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
    price: formData.get("price")?.toString() || undefined,
    paid: formData.get("paid")?.toString() || undefined,
    method: formData.get("method")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const member = await requireMemberInScope(
    staffScopeFor(membership, user.id),
    parsed.data.memberId,
  );

  const priceMinor = parsed.data.price
    ? parseAmountToMinor(parsed.data.price)
    : undefined;
  if (parsed.data.price && priceMinor === null) {
    return { error: "Anlaşılan tutar geçersiz." };
  }

  const paidMinor = parsed.data.paid ? parseAmountToMinor(parsed.data.paid) : null;
  if (parsed.data.paid && paidMinor === null) {
    return { error: "Tahsil edilen tutar geçersiz." };
  }

  const result = await startOrRenewSubscription(member.id, parsed.data.planId, {
    note: parsed.data.note,
    priceMinor: priceMinor ?? undefined,
  });
  if (!result.ok) return { error: result.error };

  // Peşin alınan para varsa aynı akışta tahsilata yazılır — antrenörün
  // ikinci bir ekrana gitmesine gerek kalmasın.
  let paymentNote = "";
  if (paidMinor && paidMinor > 0) {
    const payment = await recordPayment({
      organizationId: membership.organizationId,
      memberId: member.id,
      subscriptionId: result.subscriptionId,
      amountMinor: paidMinor,
      method: normalizePaymentMethod(parsed.data.method ?? "nakit"),
      paidAt: new Date(),
      note: parsed.data.note ?? null,
      recordedByUserId: user.id,
    });
    if (payment.ok) {
      const balance = Math.max(0, result.priceMinor - paidMinor);
      paymentNote =
        balance > 0
          ? ` · ${formatMinorTR(paidMinor)} alındı, ${formatMinorTR(balance)} kaldı`
          : ` · ${formatMinorTR(paidMinor)} tahsil edildi`;
    }
  } else if (result.priceMinor > 0) {
    paymentNote = ` · ${formatMinorTR(result.priceMinor)} borç açıldı`;
  }

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uyelik.baslatildi",
    entityType: "MemberSubscription",
    entityId: member.id,
    summary: `${member.fullName} · üyelik ${result.renewed ? "yenilendi" : "başlatıldı"} (${formatDateTR(result.startDate)} – ${formatDateTR(result.endDate)}).`,
  });

  revalidateMembershipViews(member.id);
  return {
    success: `${member.fullName} · ${result.renewed ? "yenilendi" : "başlatıldı"}: ${formatDateTR(result.startDate)} – ${formatDateTR(result.endDate)}${paymentNote}`,
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

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uyelik.durum",
    entityType: "MemberSubscription",
    entityId: subscription.id,
    summary: `Üyelik durumu "${status}" olarak değiştirildi.`,
  });

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
