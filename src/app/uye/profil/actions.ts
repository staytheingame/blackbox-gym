"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import {
  personalInfoSchema,
  updateMemberPersonalInfo,
} from "@/lib/queries/member-profile";
import { recordAudit } from "@/lib/queries/audit";

export type PersonalInfoState = { error?: string; success?: string };

/**
 * Sporcu kendi kişisel bilgilerini günceller.
 *
 * Yetki tek satırda çözülüyor: hangi üye kaydı **oturumun** kaydıysa o
 * güncellenir (`getCurrentMember`). Formdan `memberId` ALINMAZ — alınsaydı
 * başka bir sporcunun kimliğini yazmak mümkün olurdu.
 */
export async function updatePersonalInfoAction(
  _prevState: PersonalInfoState,
  formData: FormData,
): Promise<PersonalInfoState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };

  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Sporcu kaydın bulunamadı." };

  const parsed = personalInfoSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    birthDate: formData.get("birthDate")?.toString() || "",
    gender: formData.get("gender")?.toString() || "belirtmedi",
    district: formData.get("district")?.toString() || undefined,
    city: formData.get("city")?.toString() || undefined,
    state: formData.get("state")?.toString() || undefined,
    postalCode: formData.get("postalCode")?.toString() || undefined,
    emergencyName: formData.get("emergencyName")?.toString() || undefined,
    emergencyPhone: formData.get("emergencyPhone")?.toString() || undefined,
    healthNote: formData.get("healthNote")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await updateMemberPersonalInfo(member.id, parsed.data);

  await recordAudit({
    organizationId: member.organizationId,
    actorUserId: user.id,
    actorLabel: result.fullName,
    action: "uye.bilgi-guncelledi",
    entityType: "Member",
    entityId: member.id,
    summary: `${result.fullName} kişisel bilgilerini güncelledi.`,
  });

  revalidatePath("/uye/profil");
  revalidatePath("/uye");
  revalidatePath(`/personel/uyeler/${member.id}`);
  revalidatePath("/personel/uyeler");

  return { success: "Bilgilerin kaydedildi." };
}
