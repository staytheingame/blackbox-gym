"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireAdmin,
  requireMemberInScope,
  requireStaff,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  EDITABLE_MEMBER_STATUSES,
  deleteMember,
  updateMemberBasics,
} from "@/lib/queries/manage";
import { recordAudit } from "@/lib/queries/audit";

const editSchema = z.object({
  memberId: z.string().min(1),
  fullName: z.string().trim().min(2, "Ad soyad gerekli.").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+()\s-]*$/, "Telefon yalnız rakam ve + ( ) - içerebilir.")
    .optional(),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta yaz.").or(z.literal("")),
  status: z.enum(EDITABLE_MEMBER_STATUSES),
});

export type ManageFormState = { error?: string; success?: string };

/**
 * Sporcunun temel bilgilerini düzenler. Antrenör yalnız KENDİ sporcusunu
 * düzenler (`requireMemberInScope`), yönetici hepsini.
 */
export async function updateMemberAction(
  _prevState: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = editSchema.safeParse({
    memberId: formData.get("memberId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  try {
    await requireMemberInScope(
      staffScopeFor(membership, user.id),
      parsed.data.memberId,
    );
  } catch {
    return { error: "Bu sporcu senin sorumluluğunda değil." };
  }

  const result = await updateMemberBasics(
    parsed.data.memberId,
    membership.organizationId,
    {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ? parsed.data.phone : null,
      email: parsed.data.email ? parsed.data.email : null,
      status: parsed.data.status,
    },
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uye.duzenlendi",
    entityType: "Member",
    entityId: parsed.data.memberId,
    summary: `${result.fullName} sporcusunun bilgileri düzenlendi.`,
  });

  revalidatePath(`/personel/uyeler/${parsed.data.memberId}`);
  revalidatePath("/personel/uyeler");
  revalidatePath("/yonetim/uyeler");
  return { success: "Bilgiler kaydedildi." };
}

/**
 * Sporcuyu kalıcı siler — YALNIZ YÖNETİCİ. Tahsilat kaydı olan sporcu
 * silinmez (muhasebe kaydı da giderdi); hata metni ne yapılacağını söyler.
 * Başarılıysa liste sayfasına yönlendirir.
 */
export async function deleteMemberAction(
  memberId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Silmek için yönetici yetkisi gerekli." };

  const result = await deleteMember(memberId, membership.organizationId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uye.silindi",
    entityType: "Member",
    entityId: memberId,
    summary: `${result.fullName} sporcusu silindi.`,
  });

  revalidatePath("/personel/uyeler");
  revalidatePath("/yonetim/uyeler");
  revalidatePath("/yonetim/kayit-linki");
  redirect("/personel/uyeler");
}
