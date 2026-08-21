"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireStaffScopeForMember,
} from "@/lib/auth/guards";
import { logTraining } from "@/lib/queries/performance";
import { reviewCheckIn } from "@/lib/queries/staff";

const logSchema = z.object({
  memberId: z.string().min(1),
  type: z.enum(["boks", "kickbox", "fight_prep", "kondisyon"]),
  durationMinutes: z.coerce.number().int().min(5).max(300),
  rounds: z.coerce.number().int().min(0).max(50).optional(),
  intensity: z.coerce.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export type StaffTrainingLogState = { error?: string; success?: boolean };

export async function logTrainingForMemberAction(
  _prevState: StaffTrainingLogState,
  formData: FormData,
): Promise<StaffTrainingLogState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const rawRounds = formData.get("rounds");
  const parsed = logSchema.safeParse({
    memberId: formData.get("memberId"),
    type: formData.get("type"),
    durationMinutes: formData.get("durationMinutes"),
    rounds: rawRounds ? rawRounds : undefined,
    intensity: formData.get("intensity"),
    notes: formData.get("notes")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  await requireStaffScopeForMember(membership.organizationId, parsed.data.memberId);
  await logTraining(parsed.data.memberId, parsed.data, user.id);

  revalidatePath(`/personel/uyeler/${parsed.data.memberId}`);
  return { success: true };
}

export async function reviewCheckInAction(
  checkInId: string,
  memberId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await requireStaffScopeForMember(membership.organizationId, memberId);
  await reviewCheckIn(checkInId, user.id);
  revalidatePath(`/personel/uyeler/${memberId}`);
}
