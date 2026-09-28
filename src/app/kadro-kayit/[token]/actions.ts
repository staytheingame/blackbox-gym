"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { registerStaffViaLink } from "@/lib/queries/staff-join-links";
import { createSession } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/queries/audit";

const registerSchema = z
  .object({
    token: z.string().min(20),
    fullName: z.string().trim().min(3, "Adını ve soyadını yaz."),
    email: z.string().trim().toLowerCase().email("Geçerli bir e-posta yaz."),
    password: z.string().min(8, "Şifre en az 8 karakter olmalı."),
    passwordAgain: z.string(),
  })
  .refine((data) => data.password === data.passwordAgain, {
    message: "Şifreler aynı değil.",
    path: ["passwordAgain"],
  });

export type StaffRegisterState = { error?: string };

/**
 * Antrenör ya da yönetici kendi hesabını açar. Rol formdan gelmez; bağlantının
 * kendisinden okunur — bağlantıyı yalnız yönetici üretebilir. Başarılı olursa
 * oturum hemen başlar ve rolünün paneline düşer.
 */
export async function registerStaffAction(
  _prevState: StaffRegisterState,
  formData: FormData,
): Promise<StaffRegisterState> {
  const parsed = registerSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await registerStaffViaLink({
    token: parsed.data.token,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: result.organizationId,
    actorUserId: result.userId,
    actorLabel: parsed.data.fullName,
    action: "personel.hesap-kuruldu",
    entityType: "OrganizationUser",
    entityId: result.userId,
    summary: `${parsed.data.fullName} kadro kayıt bağlantısıyla ${
      result.role === "admin" ? "yönetici" : "antrenör"
    } hesabını kurdu.`,
  });

  await createSession({ userId: result.userId });
  redirect(homePathForRole(result.role));
}
