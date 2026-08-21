"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/roles";
import { createMemberWithInvite, reissueInvite } from "@/lib/queries/invites";
import { recordAudit } from "@/lib/queries/audit";

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli."),
  email: z.string().email("Geçerli bir e-posta gir."),
  phone: z.string().max(30).optional(),
  status: z.enum(["active", "lead"]).default("active"),
  /** Yalnız yönetici gönderir; boşsa sporcu ekleyene atanır. */
  assignedCoachUserId: z.string().min(1).optional(),
});

export type CreateMemberState = {
  error?: string;
  /** Antrenörün kopyalayıp göndereceği davet bağlantısı. */
  inviteUrl?: string;
  memberName?: string;
};

/**
 * Sporcu ekler ve davet bağlantısı üretir. Şifre YAZILMAZ — sporcu kendi
 * belirler (bkz. `src/lib/queries/invites.ts`). Bağlantı yalnız bu ekranda
 * bir kez gösterilir; kaybolursa "Davetler" sayfasından yenisi üretilir.
 */
export async function createMemberAction(
  _prevState: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };

  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Bu işlem için personel yetkisi gerekli." };

  const parsed = createMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone")?.toString() || undefined,
    status: formData.get("status")?.toString() || "active",
    assignedCoachUserId:
      formData.get("assignedCoachUserId")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  // Başka bir antrenöre atamak yönetici işidir; antrenör kendi sporcusunu ekler.
  const requestedCoach = parsed.data.assignedCoachUserId;
  if (requestedCoach && requestedCoach !== user.id && !isAdminRole(membership.role)) {
    return { error: "Sporcuyu başka bir antrenöre yalnız yönetici atayabilir." };
  }

  const result = await createMemberWithInvite(
    membership.organizationId,
    { ...parsed.data, assignedCoachUserId: requestedCoach ?? user.id },
    user.id,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "uye.eklendi",
    entityType: "Member",
    entityId: result.memberId,
    summary: `${parsed.data.fullName} sporcu olarak eklendi ve davet bağlantısı üretildi.`,
  });

  revalidatePath("/personel/uyeler");
  revalidatePath("/personel/davetler");
  revalidatePath("/personel");

  return { inviteUrl: result.invite.url, memberName: parsed.data.fullName };
}

export type ReissueState = { error?: string; inviteUrl?: string };

/** Bağlantı kaybolduysa/süresi dolduysa yenisini üretir, eskisini iptal eder. */
export async function reissueInviteAction(
  memberId: string,
  _prevState: ReissueState,
  _formData: FormData,
): Promise<ReissueState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };

  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const result = await reissueInvite(
    memberId,
    membership.organizationId,
    user.id,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "davet.uretildi",
    entityType: "Member",
    entityId: memberId,
    summary: "Davet bağlantısı yeniden üretildi; öncekiler iptal edildi.",
  });

  revalidatePath("/personel/davetler");
  return { inviteUrl: result.invite.url };
}
