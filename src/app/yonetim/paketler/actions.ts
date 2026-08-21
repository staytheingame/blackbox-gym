"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  archiveMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
} from "@/lib/queries/admin";

/**
 * Paket tanımları. Fiyat KURUŞ cinsinden saklanır (kayan noktalı para hatası
 * olmasın diye); formda TL girilir ve burada çevrilir.
 *
 * Ders adedi boş bırakılırsa paket "sınırsız" olur — süre boyunca serbest.
 */
const planSchema = z.object({
  name: z.string().trim().min(2, "Paket adı gerekli."),
  description: z.string().trim().max(300).nullable(),
  priceLira: z.number().min(0, "Fiyat negatif olamaz.").max(1_000_000),
  durationDays: z.number().int().min(1, "Süre en az 1 gün.").max(3650),
  totalSessions: z.number().int().min(1).max(500).nullable(),
  isActive: z.boolean(),
});

export type PlanFormState = { error?: string; success?: string };

function readForm(formData: FormData) {
  const sessions = formData.get("totalSessions")?.toString().trim();
  const price = formData.get("priceLira")?.toString().trim() ?? "0";
  const description = formData.get("description")?.toString().trim();

  return {
    name: formData.get("name")?.toString() ?? "",
    description: description ? description : null,
    priceLira: Number(price.replace(",", ".")),
    durationDays: Number(formData.get("durationDays") ?? 0),
    // Boş = sınırsız. "0 ders" diye bir paket yok, o yüzden boşluk `null`.
    totalSessions: sessions ? Number(sessions) : null,
    isActive: formData.get("isActive") === "on",
  };
}

export async function createPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = planSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const { priceLira, ...rest } = parsed.data;
  await createMembershipPlan(membership.organizationId, {
    ...rest,
    priceMinor: Math.round(priceLira * 100),
  });

  revalidatePath("/yonetim/paketler");
  revalidatePath("/personel/uyelikler");
  return { success: `${parsed.data.name} eklendi.` };
}

export async function updatePlanAction(
  planId: string,
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = planSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const { priceLira, ...rest } = parsed.data;
  const ok = await updateMembershipPlan(planId, membership.organizationId, {
    ...rest,
    priceMinor: Math.round(priceLira * 100),
  });
  if (!ok) return { error: "Paket bulunamadı." };

  revalidatePath("/yonetim/paketler");
  revalidatePath("/personel/uyelikler");
  return { success: "Paket güncellendi." };
}

/** Satıştan kaldırır — silmez, geçmiş abonelikler pakete bağlı. */
export async function archivePlanAction(planId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await archiveMembershipPlan(planId, membership.organizationId);
  revalidatePath("/yonetim/paketler");
  revalidatePath("/personel/uyelikler");
}

export async function restorePlanAction(planId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await updateMembershipPlan(planId, membership.organizationId, {
    isActive: true,
  });
  revalidatePath("/yonetim/paketler");
  revalidatePath("/personel/uyelikler");
}
