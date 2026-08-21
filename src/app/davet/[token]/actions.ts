"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/queries/invites";
import { createSession } from "@/lib/auth/session";

const acceptSchema = z
  .object({
    token: z.string().min(10),
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
 * Sporcu kendi şifresini kurar. Başarılı olursa oturum HEMEN açılır —
 * yeni kullanıcıyı giriş ekranına geri göndermek gereksiz bir engel.
 */
export async function acceptInviteAction(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await acceptInvite({
    token: parsed.data.token,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });

  if (!result.ok) return { error: result.error };

  await createSession({ userId: result.userId });
  redirect("/uye");
}
