"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { changeStaffRole, setStaffStatus } from "@/lib/queries/admin";
import {
  createStaffInvite,
  reissueStaffInvite,
  revokeStaffInvite,
} from "@/lib/queries/staff-invites";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { saveCompensation } from "@/lib/queries/finance";
import { recordAudit } from "@/lib/queries/audit";
import {
  COMPENSATION_MODELS,
  describeCompensation,
  validateCompensation,
  type CompensationModel,
} from "@/domain/finance/earnings";
import { parseAmountToMinor, parsePercentToBps } from "@/domain/finance/money";

const inviteStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli."),
  email: z.string().email("Geçerli bir e-posta gir."),
  role: z.enum(["coach", "admin"]),
});

export type StaffFormState = {
  error?: string;
  success?: string;
  /** Yöneticinin kopyalayıp göndereceği davet bağlantısı. */
  inviteUrl?: string;
  staffName?: string;
};

/**
 * Kadroya davet çıkarır. Şifre YAZILMAZ — antrenör/yönetici kendi belirler
 * (bkz. `src/lib/queries/staff-invites.ts`). Bağlantı bu ekranda gösterilir;
 * kaybolursa aynı sayfadaki "Bekleyen Davetler" kartından yenisi üretilir.
 */
export async function inviteStaffAction(
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = inviteStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createStaffInvite(
    membership.organizationId,
    parsed.data,
    user.id,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "personel.davet",
    entityType: "StaffInvite",
    entityId: result.inviteId,
    summary: `${parsed.data.fullName} (${parsed.data.email}) ${ORG_ROLE_LABEL[parsed.data.role]} olarak davet edildi.`,
  });

  revalidatePath("/yonetim/kadro");
  revalidatePath("/yonetim");
  return {
    inviteUrl: result.invite.url,
    staffName: parsed.data.fullName,
    success: `${parsed.data.fullName} davet edildi. Bağlantıyı ilet — şifresini kendisi belirleyecek.`,
  };
}

/** Bağlantı kaybolduysa/süresi dolduysa yenisini üretir, eskisini iptal eder. */
export async function reissueStaffInviteAction(
  inviteId: string,
  _prevState: StaffFormState,
  _formData: FormData,
): Promise<StaffFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const result = await reissueStaffInvite(
    inviteId,
    membership.organizationId,
    user.id,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "personel.davet",
    entityType: "StaffInvite",
    entityId: inviteId,
    summary: `${result.fullName} için davet bağlantısı yeniden üretildi; öncekiler iptal edildi.`,
  });

  revalidatePath("/yonetim/kadro");
  return { inviteUrl: result.invite.url, staffName: result.fullName };
}

export async function revokeStaffInviteAction(inviteId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const result = await revokeStaffInvite(inviteId, membership.organizationId);
  if (!result.ok) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "personel.davet-iptal",
    entityType: "StaffInvite",
    entityId: inviteId,
    summary: "Personel daveti iptal edildi; bağlantı geçersizleşti.",
  });

  revalidatePath("/yonetim/kadro");
}

export async function changeRoleAction(
  organizationUserId: string,
  role: "coach" | "admin",
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const result = await changeStaffRole(
    organizationUserId,
    membership.organizationId,
    role,
  );
  if (result.ok) {
    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "personel.rol",
      entityType: "OrganizationUser",
      entityId: organizationUserId,
      summary: `Personel rolü ${ORG_ROLE_LABEL[role]} olarak değiştirildi.`,
    });
  }

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

  const result = await setStaffStatus(
    organizationUserId,
    membership.organizationId,
    status,
  );
  if (result.ok) {
    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "personel.durum",
      entityType: "OrganizationUser",
      entityId: organizationUserId,
      summary:
        status === "active"
          ? "Personel hesabı yeniden açıldı."
          : "Personel hesabı kapatıldı; panele giriş yapamaz.",
    });
  }

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
