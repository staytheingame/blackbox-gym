"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { anonymizeMember } from "@/lib/queries/privacy";
import { recordAudit } from "@/lib/queries/audit";

export type AnonymizeState = { error?: string; success?: string };

const schema = z.object({
  memberId: z.string().min(1, "Sporcu seçilmedi."),
  confirm: z.string().trim().min(1, "Onay için üye numarasını yaz."),
});

/**
 * KVKK silme talebi. Kimliğe götüren her şey silinir, geçmiş sayılar kalır
 * (bkz. `lib/queries/privacy.ts`).
 *
 * **Geri alınamaz.** O yüzden iki kapı var: yalnız yönetici çağırabilir ve
 * sporcunun üye numarasını elle yazmak zorundadır — yanlış satırdaki düğmeye
 * basmak yetmez.
 */
export async function anonymizeMemberAction(
  _prevState: AnonymizeState,
  formData: FormData,
): Promise<AnonymizeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Bu işlem yalnızca yönetici içindir." };

  const parsed = schema.safeParse({
    memberId: formData.get("memberId"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const member = await prisma.member.findFirst({
    where: {
      id: parsed.data.memberId,
      organizationId: membership.organizationId,
    },
    select: { id: true, memberNo: true, fullName: true },
  });
  if (!member) return { error: "Sporcu bulunamadı." };

  if (parsed.data.confirm !== member.memberNo) {
    return {
      error: `Onay için üye numarasını birebir yaz: ${member.memberNo}`,
    };
  }

  const result = await anonymizeMember(member.id, membership.organizationId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uye.anonimlestirildi",
    entityType: "Member",
    entityId: member.id,
    summary: `${member.memberNo} numaralı sporcunun kimlik bilgileri KVKK talebiyle silindi.`,
  });

  revalidatePath("/yonetim/kvkk");
  revalidatePath("/yonetim/uyeler");
  revalidatePath("/personel/uyeler");
  revalidatePath("/personel/onaylar");

  return {
    success: `${result.memberNo} anonimleştirildi — hesap silindi, geçmiş sayılar kaldı.`,
  };
}
