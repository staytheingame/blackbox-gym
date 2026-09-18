"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { assignCoach } from "@/lib/queries/admin";
import { recordAudit } from "@/lib/queries/audit";

export type AssignCoachState = { error?: string; success?: string };

/**
 * Sporcunun sorumlu antrenörünü değiştirir (devir) — **yalnız yönetici**.
 * Antrenör kendi listesine sporcu ekleyemez/çıkaramaz; aksi hâlde görünürlük
 * kuralı anlamsızlaşırdı.
 */
export async function assignCoachAction(
  _prevState: AssignCoachState,
  formData: FormData,
): Promise<AssignCoachState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const memberId = formData.get("memberId")?.toString() ?? "";
  const raw = formData.get("coachUserId")?.toString() ?? "";
  const coachUserId = raw === "" ? null : raw;

  if (!memberId) return { error: "Sporcu seçilmedi." };

  const result = await assignCoach(
    membership.organizationId,
    memberId,
    coachUserId,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uye.koc-atandi",
    entityType: "Member",
    entityId: memberId,
    summary: coachUserId
      ? `${result.memberName} sporcusunun sorumlu antrenörü değiştirildi.`
      : `${result.memberName} sporcusunun antrenör ataması kaldırıldı.`,
  });

  revalidatePath("/yonetim/uyeler");
  revalidatePath("/yonetim/kayit-linki");
  revalidatePath("/personel/uyeler");
  return { success: "Atama güncellendi." };
}
