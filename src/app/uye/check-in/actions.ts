"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getCurrentMember } from "@/lib/auth/guards";
import { submitCheckIn } from "@/lib/queries/performance";

const answersSchema = z.object({
  plannedSessions: z.coerce.number().int().min(0).max(14),
  completedSessions: z.coerce.number().int().min(0).max(14),
  sleepQuality: z.coerce.number().int().min(1).max(5),
  stressLevel: z.coerce.number().int().min(1).max(5),
  energyLevel: z.coerce.number().int().min(1).max(5),
  enjoyment: z.coerce.number().int().min(1).max(5),
  sorenessFlag: z.coerce.boolean(),
  note: z.string().max(500).optional(),
});

export type CheckInState = { error?: string; success?: boolean };

export async function checkInAction(
  _prevState: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const parsed = answersSchema.safeParse({
    plannedSessions: formData.get("plannedSessions"),
    completedSessions: formData.get("completedSessions"),
    sleepQuality: formData.get("sleepQuality"),
    stressLevel: formData.get("stressLevel"),
    energyLevel: formData.get("energyLevel"),
    enjoyment: formData.get("enjoyment"),
    sorenessFlag: formData.get("sorenessFlag") === "on",
    note: formData.get("note")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  if (parsed.data.completedSessions > parsed.data.plannedSessions) {
    return { error: "Tamamlanan seans planlanandan fazla olamaz." };
  }

  const result = await submitCheckIn(member.id, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/uye");
  revalidatePath("/uye/performans");
  revalidatePath("/uye/lig");
  return { success: true };
}
