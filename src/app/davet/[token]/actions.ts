"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/queries/invites";
import { acceptStaffInvite } from "@/lib/queries/staff-invites";
import { homePathForRole } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/queries/audit";

const acceptSchema = z
  .object({
    token: z.string().min(10),
    kind: z.enum(["sporcu", "personel"]),
    fullName: z.string().trim().min(3, "Ad ve soyadını yaz."),
    password: z.string().min(8, "Şifre en az 8 karakter olmalı."),
    passwordAgain: z.string(),
  })
  .refine((data) => data.password === data.passwordAgain, {
    message: "Şifreler aynı değil.",
    path: ["passwordAgain"],
  });

export type AcceptInviteState = { error?: string };

/**
 * Davet edilen kendi şifresini kurar — sporcu da personel de. Başarılı
 * olursa oturum HEMEN açılır ve rolünün açılış ekranına düşer; yeni
 * kullanıcıyı giriş ekranına geri göndermek gereksiz bir engel.
 */
export async function acceptInviteAction(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    kind: formData.get("kind"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const { token, fullName, password } = parsed.data;

  if (parsed.data.kind === "personel") {
    const result = await acceptStaffInvite({ token, password, fullName });
    if (!result.ok) return { error: result.error };

    await recordAudit({
      organizationId: result.organizationId,
      actorUserId: result.userId,
      actorLabel: fullName,
      action: "personel.hesap-kuruldu",
      entityType: "OrganizationUser",
      entityId: result.userId,
      summary: `${fullName} davet bağlantısıyla ${
        result.role === "admin" ? "yönetici" : "antrenör"
      } hesabını kurdu.`,
    });

    await createSession({ userId: result.userId });
    redirect(homePathForRole(result.role));
  }

  const result = await acceptInvite({ token, password, fullName });
  if (!result.ok) return { error: result.error };

  await createSession({ userId: result.userId });
  redirect("/uye");
}
