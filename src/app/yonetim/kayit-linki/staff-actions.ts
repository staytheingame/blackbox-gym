"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  closeStaffJoinLink,
  createStaffJoinLink,
} from "@/lib/queries/staff-join-links";
import {
  STAFF_LINK_LIMITS,
  STAFF_LINK_ROLE_LABEL,
  type StaffLinkRole,
} from "@/domain/registration/staff-link";
import { recordAudit } from "@/lib/queries/audit";
import { formatDateTR } from "@/lib/date";

const countField = (label: string) =>
  z.coerce
    .number({ message: `${label} sayı olmalı.` })
    .int(`${label} tam sayı olmalı.`)
    .min(1, `${label} en az 1 olmalı.`);

const schema = z.object({
  which: z.enum(["hepsi", "coach", "admin"]),
  coachMaxUses: countField("Antrenör kişi sayısı").max(
    STAFF_LINK_LIMITS.coach.maxUsesCap,
    `Antrenör kişi sayısı en fazla ${STAFF_LINK_LIMITS.coach.maxUsesCap}.`,
  ),
  coachDays: countField("Antrenör bağlantısı gün sayısı").max(
    STAFF_LINK_LIMITS.coach.daysCap,
    `Antrenör bağlantısı en fazla ${STAFF_LINK_LIMITS.coach.daysCap} gün.`,
  ),
  adminMaxUses: countField("Yönetici kişi sayısı").max(
    STAFF_LINK_LIMITS.admin.maxUsesCap,
    `Yönetici kişi sayısı en fazla ${STAFF_LINK_LIMITS.admin.maxUsesCap}.`,
  ),
  adminDays: countField("Yönetici bağlantısı gün sayısı").max(
    STAFF_LINK_LIMITS.admin.daysCap,
    `Yönetici bağlantısı en fazla ${STAFF_LINK_LIMITS.admin.daysCap} gün.`,
  ),
});

export type IssuedLink = {
  url: string;
  /** "12.10.2026" — son gün, ekranda gösterilecek biçimde. */
  expiresLabel: string;
  maxUses: number;
};

export type StaffLinkFormState = {
  error?: string;
  coach?: IssuedLink;
  admin?: IssuedLink;
};

function revalidateJoin(): void {
  revalidatePath("/yonetim/kayit-linki");
}

/**
 * Kadro bağlantısı üretir: `hepsi` antrenör + yönetici, ya da yalnız biri.
 * Adres yalnız bu yanıtta görünür (veritabanında özeti durur) — kaybolursa
 * aynı roldeki yenisi üretilir ve eskisi kapanır.
 *
 * Yalnız yönetici çağırabilir. Yönetici bağlantısı tek kişilik ve kısa ömürlüdür.
 */
export async function createStaffJoinLinksAction(
  _prevState: StaffLinkFormState,
  formData: FormData,
): Promise<StaffLinkFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = schema.safeParse({
    which: formData.get("which")?.toString() || "hepsi",
    coachMaxUses:
      formData.get("coachMaxUses")?.toString() ||
      STAFF_LINK_LIMITS.coach.defaultMaxUses,
    coachDays:
      formData.get("coachDays")?.toString() || STAFF_LINK_LIMITS.coach.defaultDays,
    adminMaxUses:
      formData.get("adminMaxUses")?.toString() ||
      STAFF_LINK_LIMITS.admin.defaultMaxUses,
    adminDays:
      formData.get("adminDays")?.toString() || STAFF_LINK_LIMITS.admin.defaultDays,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const roles: StaffLinkRole[] =
    parsed.data.which === "hepsi" ? ["coach", "admin"] : [parsed.data.which];
  const state: StaffLinkFormState = {};

  for (const role of roles) {
    const maxUses =
      role === "admin" ? parsed.data.adminMaxUses : parsed.data.coachMaxUses;
    const days = role === "admin" ? parsed.data.adminDays : parsed.data.coachDays;

    const result = await createStaffJoinLink({
      organizationId: membership.organizationId,
      label: `${STAFF_LINK_ROLE_LABEL[role]} kayıt bağlantısı`,
      role,
      maxUses,
      days,
      createdByUserId: user.id,
    });
    if (!result.ok) return { ...state, error: result.error };

    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "kadro-linki.uretildi",
      entityType: "StaffJoinLink",
      entityId: result.id,
      summary: `${STAFF_LINK_ROLE_LABEL[role]} kayıt bağlantısı üretildi (en fazla ${result.maxUses} kişi, ${formatDateTR(result.expiresAt)} tarihine kadar). Aynı roldeki önceki bağlantılar kapatıldı.`,
    });

    state[role] = {
      url: result.url,
      expiresLabel: formatDateTR(result.expiresAt),
      maxUses: result.maxUses,
    };
  }

  revalidateJoin();
  return state;
}

export async function closeStaffJoinLinkAction(linkId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const closed = await closeStaffJoinLink(linkId, membership.organizationId);
  if (!closed) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kadro-linki.kapatildi",
    entityType: "StaffJoinLink",
    entityId: linkId,
    summary: "Kadro kayıt bağlantısı kapatıldı.",
  });

  revalidateJoin();
}
