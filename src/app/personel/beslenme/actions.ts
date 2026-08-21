"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import {
  addFood,
  addMeal,
  createPlan,
  deleteFood,
  deleteMeal,
  deletePlan,
  updatePlan,
} from "@/lib/queries/nutrition";
import { NUTRITION_STATUSES, DAY_TYPES } from "@/domain/nutrition/plan";

function revalidateNutrition(planId?: string, memberId?: string): void {
  revalidatePath("/personel/beslenme");
  if (planId) revalidatePath(`/personel/beslenme/${planId}`);
  if (memberId) revalidatePath(`/personel/uyeler/${memberId}`);
  revalidatePath("/uye/beslenme");
}

/** Boş metin alanını `null`'a çevirir — "" ile null aynı şey değil. */
function optionalText(value: FormDataEntryValue | null): string | null {
  const text = value?.toString().trim();
  return text ? text : null;
}

/** Boş sayı alanı `null`; "0" gerçek bir değerdir, korunur. */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = value?.toString().trim();
  if (!text) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const planSchema = z.object({
  memberId: z.string().min(1, "Sporcu seç."),
  title: z.string().trim().min(2, "Plan adı gerekli."),
  goal: z.string().trim().max(200).optional().nullable(),
  status: z.enum(NUTRITION_STATUSES),
  dayType: z.enum(DAY_TYPES).optional().nullable(),
  weekDaysCsv: z.string().nullable().optional(),
  dailyCalories: z.number().int().min(0).max(10000).nullable(),
  proteinG: z.number().int().min(0).max(1000).nullable(),
  carbsG: z.number().int().min(0).max(1000).nullable(),
  fatG: z.number().int().min(0).max(1000).nullable(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type PlanFormState = { error?: string; success?: string };

function readPlanForm(formData: FormData) {
  const weekDays = formData
    .getAll("weekDays")
    .map((value) => Number(value))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);

  return {
    memberId: formData.get("memberId")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    goal: optionalText(formData.get("goal")),
    status: formData.get("status")?.toString() ?? "taslak",
    dayType: optionalText(formData.get("dayType")),
    weekDaysCsv: weekDays.length > 0 ? weekDays.sort().join(",") : null,
    dailyCalories: optionalNumber(formData.get("dailyCalories")),
    proteinG: optionalNumber(formData.get("proteinG")),
    carbsG: optionalNumber(formData.get("carbsG")),
    fatG: optionalNumber(formData.get("fatG")),
    notes: optionalText(formData.get("notes")),
  };
}

export async function createPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = planSchema.safeParse(readPlanForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createPlan(
    membership.organizationId,
    parsed.data,
    user.id,
  );
  if (!result.ok) return { error: result.error };

  revalidateNutrition(result.planId, parsed.data.memberId);
  redirect(`/personel/beslenme/${result.planId}`);
}

export async function updatePlanAction(
  planId: string,
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = planSchema.safeParse(readPlanForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const ok = await updatePlan(planId, membership.organizationId, parsed.data);
  if (!ok) return { error: "Plan bulunamadı." };

  revalidateNutrition(planId, parsed.data.memberId);
  return { success: "Plan güncellendi." };
}

/** Durum değişimi (taslak → aktif → arşiv) tek tıkla. */
export async function setPlanStatusAction(
  planId: string,
  status: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;
  if (!(NUTRITION_STATUSES as readonly string[]).includes(status)) return;

  await updatePlan(planId, membership.organizationId, { status });
  revalidateNutrition(planId);
}

export async function deletePlanAction(planId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await deletePlan(planId, membership.organizationId);
  revalidateNutrition();
  redirect("/personel/beslenme");
}

const mealSchema = z.object({
  title: z.string().trim().min(2, "Öğün adı gerekli."),
  timeLabel: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export async function addMealAction(
  planId: string,
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = mealSchema.safeParse({
    title: formData.get("title")?.toString() ?? "",
    timeLabel: optionalText(formData.get("timeLabel")),
    notes: optionalText(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const ok = await addMeal(planId, membership.organizationId, parsed.data);
  if (!ok) return { error: "Plan bulunamadı." };

  revalidateNutrition(planId);
  return { success: "Öğün eklendi." };
}

export async function deleteMealAction(
  mealId: string,
  planId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await deleteMeal(mealId, membership.organizationId);
  revalidateNutrition(planId);
}

const foodSchema = z.object({
  name: z.string().trim().min(2, "Besin adı gerekli."),
  amount: z.string().trim().max(60).nullable(),
  calories: z.number().int().min(0).max(5000).nullable(),
  proteinG: z.number().min(0).max(500).nullable(),
  carbsG: z.number().min(0).max(500).nullable(),
  fatG: z.number().min(0).max(500).nullable(),
  alternatives: z.string().trim().max(300).nullable(),
  notes: z.string().trim().max(300).nullable(),
});

export async function addFoodAction(
  mealId: string,
  planId: string,
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = foodSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    amount: optionalText(formData.get("amount")),
    calories: optionalNumber(formData.get("calories")),
    proteinG: optionalNumber(formData.get("proteinG")),
    carbsG: optionalNumber(formData.get("carbsG")),
    fatG: optionalNumber(formData.get("fatG")),
    alternatives: optionalText(formData.get("alternatives")),
    notes: optionalText(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const ok = await addFood(mealId, membership.organizationId, parsed.data);
  if (!ok) return { error: "Öğün bulunamadı." };

  revalidateNutrition(planId);
  return { success: "Besin eklendi." };
}

export async function deleteFoodAction(
  foodId: string,
  planId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await deleteFood(foodId, membership.organizationId);
  revalidateNutrition(planId);
}
