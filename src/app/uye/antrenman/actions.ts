"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getCurrentMember } from "@/lib/auth/guards";
import { logTraining } from "@/lib/queries/performance";

const logSchema = z.object({
  type: z.enum(["boks", "kickbox", "fight_prep", "kondisyon"]),
  durationMinutes: z.coerce.number().int().min(5).max(300),
  rounds: z.coerce.number().int().min(0).max(50).optional(),
  intensity: z.coerce.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export type TrainingLogState = { error?: string; success?: boolean };

export async function logTrainingAction(
  _prevState: TrainingLogState,
  formData: FormData,
): Promise<TrainingLogState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const rawRounds = formData.get("rounds");
  const parsed = logSchema.safeParse({
    type: formData.get("type"),
    durationMinutes: formData.get("durationMinutes"),
    rounds: rawRounds ? rawRounds : undefined,
    intensity: formData.get("intensity"),
    notes: formData.get("notes")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  await logTraining(member.id, parsed.data, user.id);

  revalidatePath("/uye/antrenman");
  revalidatePath("/uye");
  revalidatePath("/uye/lig");
  return { success: true };
}
