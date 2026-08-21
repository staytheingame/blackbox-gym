"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { toggleMealCheck } from "@/lib/queries/nutrition";

/**
 * Sporcu öğünü "yedim" diye işaretler ya da geri alır. Gün bazında çalışır —
 * ertesi gün liste sıfırlanır. Antrenör bu işaretlerden uyum yüzdesini görür
 * (bkz. `getNutritionCompliance`).
 */
export async function toggleMealAction(mealId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const member = await getCurrentMember(user.id);
  if (!member) return;

  await toggleMealCheck(member.id, mealId);

  revalidatePath("/uye/beslenme");
  revalidatePath("/uye");
}
