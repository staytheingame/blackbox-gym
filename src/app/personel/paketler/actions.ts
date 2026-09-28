"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { parseAmountToMinor } from "@/domain/finance/money";
import { formatPriceTR } from "@/lib/queries/memberships";
import { updateMembershipPlan } from "@/lib/queries/admin";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/queries/audit";

export type PriceFormState = { error?: string; success?: string };

/** Bir paket 1 milyon TL'yi geçemez — yanlışlıkla fazladan sıfır yazılmasına karşı. */
const MAX_PRICE_MINOR = 100_000_000;

/**
 * Antrenör paket FİYATINI düzeltir. Yalnız fiyat: paket adı, süre, ders
 * adedi, satıştan kaldırma ve yeni paket açma yönetici işidir.
 *
 * Değişiklik yalnız bundan sonra başlatılacak üyelikleri etkiler — mevcut
 * abonelikler satın alma anındaki tutarı taşır (bkz. `MemberSubscription`).
 * Her değişiklik denetim kaydına eski ve yeni tutarla düşer.
 */
export async function updatePlanPriceAction(
  planId: string,
  _prevState: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Antrenör yetkisi gerekli." };

  const priceMinor = parseAmountToMinor(
    formData.get("priceLira")?.toString() ?? "",
  );
  if (priceMinor === null || priceMinor < 0 || priceMinor > MAX_PRICE_MINOR) {
    return { error: "Geçerli bir fiyat yaz (0 – 1.000.000 ₺)." };
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, organizationId: membership.organizationId },
    select: { name: true, priceMinor: true, currency: true },
  });
  if (!plan) return { error: "Paket bulunamadı." };
  if (plan.priceMinor === priceMinor) return { success: "Fiyat zaten bu." };

  const ok = await updateMembershipPlan(planId, membership.organizationId, {
    priceMinor,
  });
  if (!ok) return { error: "Paket bulunamadı." };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "paket.fiyat-degisti",
    entityType: "MembershipPlan",
    entityId: planId,
    summary: `${plan.name} fiyatı ${formatPriceTR(plan.priceMinor, plan.currency)} → ${formatPriceTR(priceMinor, plan.currency)} olarak düzeltildi.`,
  });

  revalidatePath("/personel/paketler");
  revalidatePath("/personel/uyelikler");
  revalidatePath("/yonetim/paketler");
  return { success: "Fiyat güncellendi." };
}
