"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  STAFF_LINK_DEFAULT_DAYS,
  STAFF_LINK_DEFAULT_MAX_USES,
  STAFF_LINK_MAX_DAYS_CAP,
  STAFF_LINK_MAX_USES_CAP,
  closeStaffJoinLink,
  createStaffJoinLink,
} from "@/lib/queries/staff-join-links";
import { recordAudit } from "@/lib/queries/audit";
import { formatDateTR } from "@/lib/date";

const createSchema = z.object({
  label: z.string().trim().min(3, "Bağlantıya bir ad ver.").max(60),
  maxUses: z.coerce
    .number()
    .int("Kişi sayısı tam sayı olmalı.")
    .min(1, "En az 1 kişi.")
    .max(STAFF_LINK_MAX_USES_CAP, `En fazla ${STAFF_LINK_MAX_USES_CAP} kişi.`),
  days: z.coerce
    .number()
    .int("Gün sayısı tam sayı olmalı.")
    .min(1, "En az 1 gün.")
    .max(STAFF_LINK_MAX_DAYS_CAP, `En fazla ${STAFF_LINK_MAX_DAYS_CAP} gün.`),
});

export type StaffLinkFormState = {
  error?: string;
  url?: string;
  /** "12.10.2026" — son gün, ekranda gösterilecek biçimde. */
  expiresLabel?: string;
  maxUses?: number;
};

function revalidateJoin(): void {
  revalidatePath("/yonetim/kayit-linki");
}

/**
 * Antrenörler için yeni kadro bağlantısı üretir; öncekileri kapatır. Adres
 * yalnız bu yanıtta görünür (veritabanında özeti durur) — kaybolursa yenisi
 * üretilir.
 */
export async function createStaffJoinLinkAction(
  _prevState: StaffLinkFormState,
  formData: FormData,
): Promise<StaffLinkFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = createSchema.safeParse({
    label: formData.get("label")?.toString() || "Antrenör kayıt bağlantısı",
    maxUses: formData.get("maxUses")?.toString() || STAFF_LINK_DEFAULT_MAX_USES,
    days: formData.get("days")?.toString() || STAFF_LINK_DEFAULT_DAYS,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createStaffJoinLink({
    organizationId: membership.organizationId,
    label: parsed.data.label,
    maxUses: parsed.data.maxUses,
    days: parsed.data.days,
    createdByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kadro-linki.uretildi",
    entityType: "StaffJoinLink",
    entityId: result.id,
    summary: `"${parsed.data.label}" antrenör kayıt bağlantısı üretildi (en fazla ${result.maxUses} kişi, ${formatDateTR(result.expiresAt)} tarihine kadar). Önceki bağlantılar kapatıldı.`,
  });

  revalidateJoin();
  return {
    url: result.url,
    expiresLabel: formatDateTR(result.expiresAt),
    maxUses: result.maxUses,
  };
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
    summary: "Antrenör kayıt bağlantısı kapatıldı.",
  });

  revalidateJoin();
}
