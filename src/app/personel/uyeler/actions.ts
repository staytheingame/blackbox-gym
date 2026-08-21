"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { createMemberWithAccount } from "@/lib/queries/staff";

const createMemberSchema = z.object({
  fullName: z.string().min(2, "Ad soyad gerekli."),
  email: z.string().email("Geçerli bir e-posta gir."),
  phone: z.string().max(30).optional(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
});

export type CreateMemberState = { error?: string; success?: boolean };

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
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createMemberWithAccount(
    membership.organizationId,
    parsed.data,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/personel/uyeler");
  revalidatePath("/personel");
  return { success: true };
}
