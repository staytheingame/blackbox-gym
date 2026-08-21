"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireStaffScopeForMember,
} from "@/lib/auth/guards";
import { addWeightEntry, setWeightGoal } from "@/lib/queries/weight";
import { weightClasses } from "@/data/weight-classes";

const entrySchema = z.object({
  memberId: z.string().min(1, "Sporcu seçilmedi."),
  weightKg: z.coerce.number().min(30).max(250),
  bodyFatPercent: z.coerce.number().min(3).max(60).optional(),
  note: z.string().max(200).optional(),
});

export type StaffWeightEntryState = { error?: string; success?: string };

/** Antrenör salondaki tartıdan okuduğu değeri sporcu adına girer. */
export async function addWeightForMemberAction(
  _prevState: StaffWeightEntryState,
  formData: FormData,
): Promise<StaffWeightEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const rawFat = formData.get("bodyFatPercent");
  const parsed = entrySchema.safeParse({
    memberId: formData.get("memberId"),
    weightKg: formData.get("weightKg"),
    bodyFatPercent: rawFat ? rawFat : undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const member = await requireStaffScopeForMember(
    membership.organizationId,
    parsed.data.memberId,
  );

  await addWeightEntry(
    member.id,
    {
      weightKg: parsed.data.weightKg,
      bodyFatPercent: parsed.data.bodyFatPercent,
      note: parsed.data.note,
    },
    user.id,
  );

  revalidatePath("/personel/tarti");
  revalidatePath(`/personel/uyeler/${member.id}`);
  revalidatePath("/uye/tarti");
  return { success: `${member.fullName} · ${parsed.data.weightKg} kg kaydedildi.` };
}

const goalSchema = z.object({
  memberId: z.string().min(1, "Sporcu seçilmedi."),
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

export type StaffWeightGoalState = { error?: string; success?: string };

/** Sıklet hedefi/maç tarihi — yeni hedef eskisini kapatır, geçmiş silinmez. */
export async function setGoalForMemberAction(
  _prevState: StaffWeightGoalState,
  formData: FormData,
): Promise<StaffWeightGoalState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = goalSchema.safeParse({
    memberId: formData.get("memberId"),
    targetKg: formData.get("targetKg"),
    weightClass: formData.get("weightClass")?.toString() ?? "",
    fightDate: formData.get("fightDate")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const member = await requireStaffScopeForMember(
    membership.organizationId,
    parsed.data.memberId,
  );

  await setWeightGoal(member.id, {
    targetKg: parsed.data.targetKg,
    weightClass: parsed.data.weightClass || undefined,
    // `YYYY-MM-DD` gelir; gün başlangıcı UTC olarak yorumlanır.
    fightDate: parsed.data.fightDate
      ? new Date(`${parsed.data.fightDate}T00:00:00.000Z`)
      : undefined,
  });

  revalidatePath("/personel/tarti");
  revalidatePath("/uye/tarti");
  return { success: `${member.fullName} hedefi güncellendi.` };
}
