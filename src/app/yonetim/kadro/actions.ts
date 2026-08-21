"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  changeStaffRole,
  createStaffAccount,
  setStaffStatus,
} from "@/lib/queries/admin";
import { saveCompensation } from "@/lib/queries/finance";
import { recordAudit } from "@/lib/queries/audit";
import {
  COMPENSATION_MODELS,
  describeCompensation,
  validateCompensation,
  type CompensationModel,
} from "@/domain/finance/earnings";
import { parseAmountToMinor, parsePercentToBps } from "@/domain/finance/money";

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli."),
  email: z.string().email("Geçerli bir e-posta gir."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı."),
  role: z.enum(["coach", "admin"]),
});

export type StaffFormState = { error?: string; success?: string };

/**
 * Antrenör/yönetici hesabı açar. Sporcudan farklı olarak burada geçici şifre
 * yazılır — personel hesabı salonda yüz yüze kurulur (bkz. `admin.ts`).
 */
export async function createStaffAction(
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = createStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createStaffAccount(
    membership.organizationId,
    parsed.data,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/yonetim/kadro");
  revalidatePath("/yonetim");
  return {
    success: `${parsed.data.fullName} eklendi. Geçici şifreyi ilet ve değiştirmesini söyle.`,
  };
}

export async function changeRoleAction(
  organizationUserId: string,
  role: "coach" | "admin",
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await changeStaffRole(organizationUserId, membership.organizationId, role);
  revalidatePath("/yonetim/kadro");
}

export async function setStatusAction(
  organizationUserId: string,
  status: "active" | "disabled",
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await setStaffStatus(organizationUserId, membership.organizationId, status);
  revalidatePath("/yonetim/kadro");
  revalidatePath("/yonetim");
}

export type CompensationState = { error?: string; success?: string };

/**
 * Antrenörün hakediş ayarını kaydeder. Tutarlar formda **lira** yazılır,
 * kuruşa burada çevrilir (`parseAmountToMinor`); yüzde baz puana çevrilir.
 *
 * Geçmişe dokunmaz: doğmuş hakedişler `CoachEarning` satırında dondurulmuştur.
 */
export async function saveCompensationAction(
  _prevState: CompensationState,
  formData: FormData,
): Promise<CompensationState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const coachUserId = formData.get("coachUserId")?.toString() ?? "";
  if (!coachUserId) return { error: "Antrenör seçilmedi." };

  const rawModel = formData.get("model")?.toString() ?? "yok";
  if (!(COMPENSATION_MODELS as readonly string[]).includes(rawModel)) {
    return { error: "Geçersiz hakediş modeli." };
  }
  const model = rawModel as CompensationModel;

  const perSessionRaw = formData.get("perSession")?.toString()?.trim() ?? "";
  const shareRaw = formData.get("revenueShare")?.toString()?.trim() ?? "";
  const salaryRaw = formData.get("monthlySalary")?.toString()?.trim() ?? "";
  const quotaRaw = formData.get("monthlyQuota")?.toString()?.trim() ?? "";

  const perSessionMinor = perSessionRaw ? parseAmountToMinor(perSessionRaw) : null;
  if (perSessionRaw && perSessionMinor === null) {
    return { error: "Ders başı ücret geçersiz." };
  }

  const revenueShareBps = shareRaw ? parsePercentToBps(shareRaw) : null;
  if (shareRaw && revenueShareBps === null) {
    return { error: "Gelir payı yüzdesi 0–100 arası olmalı." };
  }

  const monthlySalaryMinor = salaryRaw ? parseAmountToMinor(salaryRaw) : null;
  if (salaryRaw && monthlySalaryMinor === null) {
    return { error: "Aylık maaş tutarı geçersiz." };
  }

  const monthlySessionQuota = quotaRaw ? Number(quotaRaw) : null;
  if (
    quotaRaw &&
    (!Number.isInteger(monthlySessionQuota) || (monthlySessionQuota ?? 0) < 0)
  ) {
    return { error: "Aylık ders hakkı tam sayı olmalı." };
  }

  const compensation = {
    model,
    perSessionMinor,
    revenueShareBps,
    monthlySalaryMinor,
    monthlySessionQuota,
  };

  const valid = validateCompensation(compensation);
  if (!valid.ok) return { error: valid.error };

  const result = await saveCompensation({
    organizationId: membership.organizationId,
    coachUserId,
    ...compensation,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "hakedis.ayarlandi",
    entityType: "CoachCompensation",
    entityId: coachUserId,
    summary: `Hakediş ayarı güncellendi: ${describeCompensation(compensation)}.`,
  });

  revalidatePath("/yonetim/kadro");
  revalidatePath("/yonetim/muhasebe/hakedis");
  return { success: "Hakediş ayarı kaydedildi." };
}
