"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getCurrentMember } from "@/lib/auth/guards";
import { logTraining } from "@/lib/queries/performance";
import {
  completePlanDay,
  memberOwnsPlan,
  uncompletePlanDay,
} from "@/lib/queries/plans";

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

/**
 * Program gününü tamamlandı/geri al. Yetki: plan gerçekten bu üyeye mi ait
 * (`memberOwnsPlan`) — "formda id vardı" güvenlik sayılmaz.
 *
 * Tamamlama o günün planından bir antrenman kaydı üretir (puan + rozet);
 * geri alma kaydı siler ve puanı ters kayıtla iade eder.
 */
export async function togglePlanDayAction(
  memberPlanId: string,
  dayId: string,
  completed: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const member = await getCurrentMember(user.id);
  if (!member) return;

  const owns = await memberOwnsPlan(member.id, memberPlanId);
  if (!owns) return;

  if (completed) {
    await uncompletePlanDay(member.id, memberPlanId, dayId);
  } else {
    await completePlanDay(member.id, memberPlanId, dayId, user.id);
  }

  revalidatePath("/uye/antrenman");
  revalidatePath("/uye/kondisyon");
  revalidatePath("/uye");
  revalidatePath("/uye/lig");
}
