"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { signWaiver } from "@/lib/queries/waivers";
import { recordAudit } from "@/lib/queries/audit";

export type SignWaiverState = { error?: string; success?: string };

const signSchema = z.object({
  templateId: z.string().min(1),
  signedName: z.string().trim().min(3, "Ad soyad yaz."),
  confirmed: z.literal(true, { message: "Onay kutusunu işaretlemen gerekiyor." }),
  birthDate: z.string().optional(),
  guardianName: z.string().max(80).optional(),
  guardianPhone: z.string().max(30).optional(),
});

/**
 * Sporcu formu onaylar. İmza kaydı metnin O ANKİ sürümüne bağlanır — metin
 * sonradan değişirse imza silinmez, "eski sürüm" olarak görünür.
 *
 * Sağlık soruları `soru:<metin>` adıyla gelir; "evet" yanıtları antrenörün
 * göreceği nota dönüşür (bkz. `domain/waivers/status.ts`).
 */
export async function signWaiverAction(
  _prevState: SignWaiverState,
  formData: FormData,
): Promise<SignWaiverState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireOrganizationMembership(user.id);
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const parsed = signSchema.safeParse({
    templateId: formData.get("templateId"),
    signedName: formData.get("signedName"),
    confirmed: formData.get("confirmed") === "on",
    birthDate: formData.get("birthDate")?.toString() || undefined,
    guardianName: formData.get("guardianName")?.toString() || undefined,
    guardianPhone: formData.get("guardianPhone")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("soru:")) continue;
    answers[key.slice(5)] = value.toString() === "evet" ? "evet" : "hayir";
  }

  const birthDate = parsed.data.birthDate
    ? new Date(parsed.data.birthDate)
    : null;
  if (birthDate && Number.isNaN(birthDate.getTime())) {
    return { error: "Doğum tarihi geçersiz." };
  }

  const result = await signWaiver(
    {
      memberId: member.id,
      templateId: parsed.data.templateId,
      signedName: parsed.data.signedName,
      birthDate,
      guardianName: parsed.data.guardianName,
      guardianPhone: parsed.data.guardianPhone,
      answers: Object.keys(answers).length > 0 ? answers : undefined,
    },
    membership.organizationId,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: parsed.data.signedName,
    action: "onam.imzalandi",
    entityType: "Member",
    entityId: member.id,
    summary: `${member.fullName} onam formunu imzaladı (v${result.version}).`,
  });

  revalidatePath("/uye/onaylar");
  revalidatePath("/uye");
  revalidatePath("/personel/onaylar");
  revalidatePath(`/personel/uyeler/${member.id}`);

  return {
    success: result.healthNote
      ? "Onayın kaydedildi. Beyanındaki maddeleri antrenörün görecek."
      : "Onayın kaydedildi.",
  };
}
