"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir."),
  password: z.string().min(1, "Şifre gerekli."),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // E-posta var/yok bilgisini sızdırmamak için aynı hata mesajı kullanılır.
  const genericError = { error: "E-posta veya şifre hatalı." };
  if (!user) return genericError;

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return genericError;

  await createSession({ userId: user.id });

  const membership = await prisma.organizationUser.findFirst({
    where: { userId: user.id, status: "active" },
  });

  redirect(membership?.role === "staff" ? "/personel" : "/uye");
}
