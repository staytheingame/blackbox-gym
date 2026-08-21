"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireMemberInScope,
  requireStaffScope,
} from "@/lib/auth/guards";
import { recordAudit } from "@/lib/queries/audit";
import { recordPayment } from "@/lib/queries/finance";
import {
  PAYMENT_METHODS,
  normalizePaymentMethod,
} from "@/domain/finance/ledger";
import { formatMinorTR, parseAmountToMinor } from "@/domain/finance/money";
import { gymDateTimeToInstant, toGymDateKey } from "@/lib/date";

export type FinanceState = { error?: string; success?: string };

/**
 * Antrenörün **kendi sporcusundan** tahsilat girmesi. Salonda parayı çoğu
 * zaman dersi veren kişi alıyor; kapsam kontrolü `requireMemberInScope` ile
 * yapılır — başka antrenörün sporcusuna kayıt girilemez.
 *
 * Yönetici de bu ekranı kullanabilir; onun kapsamı salonun tamamıdır.
 */
export async function recordOwnMemberPaymentAction(
  _prevState: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };

  const staff = await requireStaffScope(user.id).catch(() => null);
  if (!staff) return { error: "Personel yetkisi gerekli." };

  const memberId = formData.get("memberId")?.toString() ?? "";
  if (!memberId) return { error: "Sporcu seç." };

  const member = await requireMemberInScope(staff.scope, memberId).catch(
    () => null,
  );
  if (!member) return { error: "Bu sporcu senin sorumluluğunda değil." };

  const amountMinor = parseAmountToMinor(formData.get("amount")?.toString() ?? "");
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Tutar geçersiz." };
  }

  const rawMethod = formData.get("method")?.toString() ?? "nakit";
  const method = normalizePaymentMethod(
    (PAYMENT_METHODS as readonly string[]).includes(rawMethod) ? rawMethod : "nakit",
  );

  const rawDate = formData.get("paidAt")?.toString();
  const dateKey =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : toGymDateKey(new Date());

  const result = await recordPayment({
    organizationId: staff.membership.organizationId,
    memberId: member.id,
    subscriptionId: formData.get("subscriptionId")?.toString() || null,
    amountMinor,
    method,
    paidAt: gymDateTimeToInstant(dateKey, "12:00"),
    note: formData.get("note")?.toString() || null,
    recordedByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: staff.membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "tahsilat.eklendi",
    entityType: "Payment",
    entityId: result.paymentId,
    summary: `${member.fullName} — ${formatMinorTR(amountMinor)} tahsilat girildi.`,
  });

  revalidatePath("/personel/kasa");
  revalidatePath("/personel/uyelikler");
  revalidatePath("/yonetim/muhasebe");
  revalidatePath("/yonetim/muhasebe/tahsilat");

  return {
    success:
      result.earningMinor > 0
        ? `Tahsilat kaydedildi. Payın: ${formatMinorTR(result.earningMinor)}.`
        : "Tahsilat kaydedildi.",
  };
}
