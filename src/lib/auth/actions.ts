"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/giris");
}

// Davet ekranındaki kuralla aynı (bkz. `src/app/davet/[token]/actions.ts`) —
// iki yerde farklı eşik olursa davetten 8 karakterle giren kullanıcı burada
// reddedilir.
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifreni gir."),
    password: z.string().min(8, "Yeni şifre en az 8 karakter olmalı."),
    passwordAgain: z.string(),
  })
  .refine((data) => data.password === data.passwordAgain, {
    message: "Şifreler eşleşmiyor.",
    path: ["passwordAgain"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Yeni şifre eskisiyle aynı olamaz.",
    path: ["password"],
  });

export type ChangePasswordState = { error?: string; success?: string };

/**
 * Oturumdaki kullanıcının kendi şifresini değiştirir — sporcu, antrenör ve
 * yönetici için aynı akış.
 *
 * Mevcut şifre bilerek soruluyor: oturum çerezi 30 gün yaşıyor ve açık kalmış
 * bir telefonu eline geçiren biri şifreyi değiştirip hesabı devralabilirdi.
 *
 * BİLİNEN SINIR: çerez yalnız `userId` taşıyor (bkz. `session.ts`), şifre
 * özetine bağlı değil — bu yüzden şifre değişince kullanıcının BAŞKA
 * cihazlardaki oturumları düşmez. Oturum iptali ayrı bir iş; şifre değiştirme
 * ekranı da bunu vaat etmiyor.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { error: "Hesap bulunamadı." };

  const ok = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return { error: "Mevcut şifre yanlış." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  return {
    success:
      "Şifren değişti. Diğer cihazlarında açık oturumlar varsa etkilenmez — oralarda çıkış yapmayı unutma.",
  };
}
