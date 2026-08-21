import "server-only";
import { prisma } from "@/lib/db";
import { gymDayOfWeek, toGymDateKey } from "@/lib/date";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  computeCompliance,
  planAppliesToDay,
  sumMacros,
  type Compliance,
  type MacroTotals,
} from "@/domain/nutrition/plan";

/**
 * Beslenme planı sorguları — plan → öğün → besin ağacı tek gidişte çekilir.
 *
 * Ölçek kabulü: bir sporcunun aynı anda birkaç planı, plan başına 4–8 öğün,
 * öğün başına birkaç besin olur. Bu boyutta `include` ile ağacı komple almak
 * sayfa başına tek sorgu demektir; parçalı çekmek N+1 üretirdi.
 */

/** Gün karşılaştırmaları UTC gece yarısına sabitlenir (bkz. `MealCheck.logDate`). */
function toDayKeyDate(date: Date): Date {
  const [year, month, day] = toGymDateKey(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export type NutritionFoodView = {
  id: string;
  name: string;
  amount: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  alternatives: string | null;
  notes: string | null;
};

export type NutritionMealView = {
  id: string;
  position: number;
  title: string;
  timeLabel: string | null;
  notes: string | null;
  foods: NutritionFoodView[];
  totals: MacroTotals;
  /** Sporcu bugün bu öğünü işaretledi mi. */
  checkedToday: boolean;
};

export type NutritionPlanView = {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  goal: string | null;
  status: string;
  startDate: Date | null;
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  dayType: string | null;
  weekDaysCsv: string | null;
  updatedAt: Date;
  meals: NutritionMealView[];
  totals: MacroTotals;
  /** Bugün bu plan geçerli mi (haftalık döngüde gün eşleşmesi). */
  activeToday: boolean;
};

const planInclude = {
  member: { select: { fullName: true } },
  meals: {
    orderBy: { position: "asc" as const },
    include: { foods: { orderBy: { position: "asc" as const } } },
  },
} as const;

type PlanRow = {
  id: string;
  memberId: string;
  member: { fullName: string };
  title: string;
  goal: string | null;
  status: string;
  startDate: Date | null;
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  dayType: string | null;
  weekDaysCsv: string | null;
  updatedAt: Date;
  meals: {
    id: string;
    position: number;
    title: string;
    timeLabel: string | null;
    notes: string | null;
    foods: NutritionFoodView[];
  }[];
};

function toPlanView(
  row: PlanRow,
  checkedMealIds: ReadonlySet<string>,
  today: number,
): NutritionPlanView {
  const meals: NutritionMealView[] = row.meals.map((meal) => ({
    id: meal.id,
    position: meal.position,
    title: meal.title,
    timeLabel: meal.timeLabel,
    notes: meal.notes,
    foods: meal.foods,
    totals: sumMacros(meal.foods),
    checkedToday: checkedMealIds.has(meal.id),
  }));

  return {
    id: row.id,
    memberId: row.memberId,
    memberName: row.member.fullName,
    title: row.title,
    goal: row.goal,
    status: row.status,
    startDate: row.startDate,
    dailyCalories: row.dailyCalories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    notes: row.notes,
    dayType: row.dayType,
    weekDaysCsv: row.weekDaysCsv,
    updatedAt: row.updatedAt,
    meals,
    totals: sumMacros(row.meals.flatMap((meal) => meal.foods)),
    activeToday: planAppliesToDay(row.weekDaysCsv, today),
  };
}

/** Sporcunun kendi ekranı: aktif planlar + bugünün işaretleri. */
export async function getMemberNutrition(memberId: string): Promise<{
  plans: NutritionPlanView[];
  compliance: Compliance;
}> {
  const now = new Date();
  const todayKey = toDayKeyDate(now);
  const today = gymDayOfWeek(now);

  const [rows, checksToday] = await Promise.all([
    prisma.nutritionPlan.findMany({
      where: { memberId, status: "aktif" },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      include: planInclude,
    }),
    prisma.mealCheck.findMany({
      where: { memberId, logDate: todayKey },
      select: { mealId: true },
    }),
  ]);

  const checkedMealIds = new Set(checksToday.map((row) => row.mealId));
  const plans = rows.map((row) => toPlanView(row, checkedMealIds, today));

  return {
    plans,
    compliance: await getNutritionCompliance(memberId, 7),
  };
}

/** Antrenörün gördüğü liste — bir sporcunun tüm planları (taslak dahil). */
export async function listMemberPlans(
  memberId: string,
): Promise<NutritionPlanView[]> {
  const today = gymDayOfWeek(new Date());
  const rows = await prisma.nutritionPlan.findMany({
    where: { memberId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: planInclude,
  });

  return rows.map((row) => toPlanView(row, new Set(), today));
}

export type NutritionPlanSummary = {
  id: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  title: string;
  status: string;
  dayType: string | null;
  weekDaysCsv: string | null;
  mealCount: number;
  dailyCalories: number | null;
  updatedAt: Date;
};

/** Salon geneli plan listesi — antrenörün beslenme ekranı. */
export async function listOrganizationPlans(
  scope: StaffScope,
): Promise<NutritionPlanSummary[]> {
  const rows = await prisma.nutritionPlan.findMany({
    where: { organizationId: scope.organizationId, member: memberWhere(scope) },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      memberId: true,
      title: true,
      status: true,
      dayType: true,
      weekDaysCsv: true,
      dailyCalories: true,
      updatedAt: true,
      member: { select: { fullName: true, memberNo: true } },
      _count: { select: { meals: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    memberId: row.memberId,
    memberName: row.member.fullName,
    memberNo: row.member.memberNo,
    title: row.title,
    status: row.status,
    dayType: row.dayType,
    weekDaysCsv: row.weekDaysCsv,
    mealCount: row._count.meals,
    dailyCalories: row.dailyCalories,
    updatedAt: row.updatedAt,
  }));
}

export async function getPlanDetail(
  planId: string,
  organizationId: string,
): Promise<NutritionPlanView | null> {
  const row = await prisma.nutritionPlan.findFirst({
    where: { id: planId, organizationId },
    include: planInclude,
  });
  if (!row) return null;

  return toPlanView(row, new Set(), gymDayOfWeek(new Date()));
}

/**
 * Son `days` gündeki öğün uyumu. Beklenen sayı AKTİF planların öğün
 * sayısından gelir; plan yoksa yüzde üretilmez (bkz. `computeCompliance`).
 *
 * Pencere PLANIN YAŞIYLA sınırlanır: dün yazılmış bir plan için "7 günün
 * 6'sında yemedin" demek haksızdır — o günlerde ortada plan yoktu. Bu yüzden
 * gün sayısı planın başlangıcından bugüne geçen süreyi aşmaz ve üç günden
 * kısa geçmişte `computeCompliance` güveni "düşük" işaretler.
 */
export async function getNutritionCompliance(
  memberId: string,
  days = 7,
): Promise<Compliance> {
  const plans = await prisma.nutritionPlan.findMany({
    where: { memberId, status: "aktif" },
    select: {
      startDate: true,
      createdAt: true,
      _count: { select: { meals: true } },
    },
  });

  // Aynı gün birden çok plan aktifse (antrenman/dinlenme günü ayrımı) günlük
  // beklenti en çok öğünlü plandır — hepsini toplamak sporcuyu haksız yere
  // uyumsuz gösterirdi.
  const mealsPerDay = plans.reduce(
    (max, plan) => Math.max(max, plan._count.meals),
    0,
  );
  if (mealsPerDay === 0) {
    return computeCompliance({ mealsPerDay: 0, days: 0, checked: 0 });
  }

  const startedAt = plans.reduce<Date>((earliest, plan) => {
    const candidate = plan.startDate ?? plan.createdAt;
    return candidate < earliest ? candidate : earliest;
  }, new Date());

  const planAgeDays = Math.max(
    1,
    Math.ceil((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const window = Math.min(days, planAgeDays);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - window);

  const checked = await prisma.mealCheck.count({
    where: { memberId, logDate: { gte: toDayKeyDate(since) } },
  });

  return computeCompliance({ mealsPerDay, days: window, checked });
}

// ── Yazma işlemleri ───────────────────────────────────────────

export type SavePlanInput = {
  memberId: string;
  title: string;
  goal?: string | null;
  status: string;
  startDate?: Date | null;
  dailyCalories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  notes?: string | null;
  dayType?: string | null;
  weekDaysCsv?: string | null;
};

export async function createPlan(
  organizationId: string,
  input: SavePlanInput,
  createdByUserId: string,
): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, organizationId },
    select: { id: true },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };

  const plan = await prisma.nutritionPlan.create({
    data: {
      organizationId,
      memberId: input.memberId,
      title: input.title,
      goal: input.goal ?? null,
      status: input.status,
      startDate: input.startDate ?? null,
      dailyCalories: input.dailyCalories ?? null,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      notes: input.notes ?? null,
      dayType: input.dayType ?? null,
      weekDaysCsv: input.weekDaysCsv ?? null,
      createdByUserId,
    },
    select: { id: true },
  });

  return { ok: true, planId: plan.id };
}

export async function updatePlan(
  planId: string,
  organizationId: string,
  input: Partial<SavePlanInput>,
): Promise<boolean> {
  const result = await prisma.nutritionPlan.updateMany({
    where: { id: planId, organizationId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dailyCalories !== undefined
        ? { dailyCalories: input.dailyCalories }
        : {}),
      ...(input.proteinG !== undefined ? { proteinG: input.proteinG } : {}),
      ...(input.carbsG !== undefined ? { carbsG: input.carbsG } : {}),
      ...(input.fatG !== undefined ? { fatG: input.fatG } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.dayType !== undefined ? { dayType: input.dayType } : {}),
      ...(input.weekDaysCsv !== undefined
        ? { weekDaysCsv: input.weekDaysCsv }
        : {}),
    },
  });

  return result.count > 0;
}

export async function deletePlan(
  planId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await prisma.nutritionPlan.deleteMany({
    where: { id: planId, organizationId },
  });
  return result.count > 0;
}

export async function addMeal(
  planId: string,
  organizationId: string,
  input: { title: string; timeLabel?: string | null; notes?: string | null },
): Promise<boolean> {
  const plan = await prisma.nutritionPlan.findFirst({
    where: { id: planId, organizationId },
    select: { id: true, _count: { select: { meals: true } } },
  });
  if (!plan) return false;

  await prisma.nutritionMeal.create({
    data: {
      planId,
      position: plan._count.meals + 1,
      title: input.title,
      timeLabel: input.timeLabel ?? null,
      notes: input.notes ?? null,
    },
  });

  await touchPlan(planId);
  return true;
}

export async function deleteMeal(
  mealId: string,
  organizationId: string,
): Promise<boolean> {
  const meal = await prisma.nutritionMeal.findFirst({
    where: { id: mealId, plan: { organizationId } },
    select: { id: true, planId: true },
  });
  if (!meal) return false;

  await prisma.nutritionMeal.delete({ where: { id: meal.id } });
  await touchPlan(meal.planId);
  return true;
}

export type AddFoodInput = {
  name: string;
  amount?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  alternatives?: string | null;
  notes?: string | null;
};

export async function addFood(
  mealId: string,
  organizationId: string,
  input: AddFoodInput,
): Promise<boolean> {
  const meal = await prisma.nutritionMeal.findFirst({
    where: { id: mealId, plan: { organizationId } },
    select: { id: true, planId: true, _count: { select: { foods: true } } },
  });
  if (!meal) return false;

  await prisma.nutritionFood.create({
    data: {
      mealId,
      position: meal._count.foods + 1,
      name: input.name,
      amount: input.amount ?? null,
      calories: input.calories ?? null,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      alternatives: input.alternatives ?? null,
      notes: input.notes ?? null,
    },
  });

  await touchPlan(meal.planId);
  return true;
}

export async function deleteFood(
  foodId: string,
  organizationId: string,
): Promise<boolean> {
  const food = await prisma.nutritionFood.findFirst({
    where: { id: foodId, meal: { plan: { organizationId } } },
    select: { id: true, meal: { select: { planId: true } } },
  });
  if (!food) return false;

  await prisma.nutritionFood.delete({ where: { id: food.id } });
  await touchPlan(food.meal.planId);
  return true;
}

/** Öğün/besin değişikliği planın "son güncelleme"sini de ilerletsin. */
async function touchPlan(planId: string): Promise<void> {
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: { updatedAt: new Date() },
  });
}

/** Sporcu öğünü işaretler/geri alır — aynı gün içinde serbestçe. */
export async function toggleMealCheck(
  memberId: string,
  mealId: string,
): Promise<{ checked: boolean } | null> {
  const meal = await prisma.nutritionMeal.findFirst({
    where: { id: mealId, plan: { memberId } },
    select: { id: true },
  });
  if (!meal) return null;

  const logDate = toDayKeyDate(new Date());
  const existing = await prisma.mealCheck.findUnique({
    where: { memberId_mealId_logDate: { memberId, mealId, logDate } },
    select: { id: true },
  });

  if (existing) {
    await prisma.mealCheck.delete({ where: { id: existing.id } });
    return { checked: false };
  }

  await prisma.mealCheck.create({ data: { memberId, mealId, logDate } });
  return { checked: true };
}
