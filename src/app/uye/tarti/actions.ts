"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { addWeightEntry, setWeightGoal } from "@/lib/queries/weight";
import { weightClasses } from "@/data/weight-classes";

const entrySchema = z.object({
  weightKg: z.coerce.number().min(30).max(250),
  bodyFatPercent: z.coerce.number().min(3).max(60).optional(),
  note: z.string().max(200).optional(),
});

export type WeightEntryState = { error?: string; success?: boolean };

export async function addWeightEntryAction(
  _prevState: WeightEntryState,
  formData: FormData,
): Promise<WeightEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const rawFat = formData.get("bodyFatPercent");
  const parsed = entrySchema.safeParse({
    weightKg: formData.get("weightKg"),
    bodyFatPercent: rawFat ? rawFat : undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  await addWeightEntry(member.id, parsed.data, user.id);

  revalidatePath("/uye/tarti");
  revalidatePath("/uye");
  return { success: true };
}

const goalSchema = z.object({
  targetKg: z.coerce.number().min(30).max(250),
  weightClass: z
    .string()
    .refine(
      (value) => value === "" || weightClasses.some((w) => w.slug === value),
      "Geçersiz sıklet.",
    )
    .optional(),
  fightDate: z.string().optional(),
});

export type WeightGoalState = { error?: string; success?: boolean };

export async function setWeightGoalAction(
  _prevState: WeightGoalState,
  formData: FormData,
): Promise<WeightGoalState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const parsed = goalSchema.safeParse({
    targetKg: formData.get("targetKg"),
    weightClass: formData.get("weightClass")?.toString() ?? "",
    fightDate: formData.get("fightDate")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  await setWeightGoal(member.id, {
    targetKg: parsed.data.targetKg,
    weightClass: parsed.data.weightClass || undefined,
    // Tarih alanı `YYYY-MM-DD` gelir; gün başlangıcı UTC olarak yorumlanır.
    fightDate: parsed.data.fightDate
      ? new Date(`${parsed.data.fightDate}T00:00:00.000Z`)
      : undefined,
  });

  revalidatePath("/uye/tarti");
  return { success: true };
}
