import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { getPlanDetail } from "@/lib/queries/nutrition";
import { listMembers } from "@/lib/queries/staff";
import {
  DAY_TYPE_LABEL,
  NUTRITION_STATUS_LABEL,
  formatWeekDays,
  macroDeviationPercent,
  type DayType,
  type NutritionStatus,
} from "@/domain/nutrition/plan";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { PlanForm } from "../PlanForm";
import { AddFoodForm, AddMealForm } from "./MealForms";
import {
  deleteFoodAction,
  deleteMealAction,
  deletePlanAction,
  setPlanStatusAction,
} from "../actions";
import {
  primaryButtonClass,
  rowButtonClass,
} from "@/components/panel/form";

export const metadata: Metadata = { title: "Beslenme Planı — BlackBox Panel" };

export default async function StaffNutritionPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  const [plan, members] = await Promise.all([
    getPlanDetail(id, membership.organizationId),
    listMembers(staffScopeFor(membership, user.id)),
  ]);
  if (!plan) notFound();

  const calorieDeviation = macroDeviationPercent(
    plan.totals.calories,
    plan.dailyCalories,
  );

  return (
    <PanelPage
      title={plan.title}
      description={`${plan.memberName} · ${plan.meals.length} öğün · ${formatWeekDays(plan.weekDaysCsv)}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/personel/beslenme" className={rowButtonClass}>
            ← Planlar
          </Link>
          <Link href={`/personel/uyeler/${plan.memberId}`} className={rowButtonClass}>
            Sporcu Kartı
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Durum"
          value={
            NUTRITION_STATUS_LABEL[plan.status as NutritionStatus] ?? plan.status
          }
          highlight={plan.status === "aktif"}
          hint={plan.status === "aktif" ? "Sporcu görüyor" : "Sporcu görmüyor"}
        />
        <StatCard
          label="Plan Toplamı"
          value={plan.totals.hasData ? plan.totals.calories : "—"}
          suffix={plan.totals.hasData ? "kcal" : undefined}
          hint={
            plan.totals.missing > 0
              ? `${plan.totals.missing} besinde makro girilmemiş`
              : "Girilen besinlerin toplamı"
          }
        />
        <StatCard
          label="Hedef"
          value={plan.dailyCalories ?? "—"}
          suffix={plan.dailyCalories ? "kcal" : undefined}
          hint={
            calorieDeviation === null
              ? "Hedef girilmedi"
              : `Toplam hedefin %${Math.abs(calorieDeviation)} ${
                  calorieDeviation >= 0 ? "üstünde" : "altında"
                }`
          }
        />
        <StatCard
          label="Protein"
          value={plan.totals.hasData ? plan.totals.proteinG : "—"}
          suffix="g"
          hint={plan.proteinG ? `Hedef ${plan.proteinG} g` : "Hedef girilmedi"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {plan.status !== "aktif" && (
          <form action={setPlanStatusAction.bind(null, plan.id, "aktif")}>
            <button
              type="submit"
              className={primaryButtonClass}
            >
              Yayına Al
            </button>
          </form>
        )}
        {plan.status === "aktif" && (
          <form action={setPlanStatusAction.bind(null, plan.id, "arsiv")}>
            <button type="submit" className={rowButtonClass}>
              Arşive Al
            </button>
          </form>
        )}
        {plan.status === "arsiv" && (
          <form action={setPlanStatusAction.bind(null, plan.id, "taslak")}>
            <button type="submit" className={rowButtonClass}>
              Taslağa Çevir
            </button>
          </form>
        )}
        <form action={deletePlanAction.bind(null, plan.id)}>
          <button
            type="submit"
            className="rounded-sm border border-red-400/40 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-red-300 transition-colors hover:bg-red-400/10"
          >
            Planı Sil
          </button>
        </form>
        {plan.dayType && (
          <Pill>{DAY_TYPE_LABEL[plan.dayType as DayType]}</Pill>
        )}
      </div>

      <PanelCard title={`Öğünler (${plan.meals.length})`}>
        {plan.meals.length === 0 ? (
          <EmptyState>
            Bu planda henüz öğün yok. Aşağıdaki formdan ilk öğünü ekle.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {plan.meals.map((meal) => (
              <div
                key={meal.id}
                className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm uppercase tracking-wide text-brand-yellow">
                      {meal.position}. {meal.title}
                      {meal.timeLabel && (
                        <span className="ml-2 text-xs font-normal normal-case tracking-normal text-brand-muted">
                          {meal.timeLabel}
                        </span>
                      )}
                    </h3>
                    {meal.notes && (
                      <p className="mt-1 text-xs text-brand-muted">
                        {meal.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {meal.totals.hasData && (
                      <Pill>{meal.totals.calories} kcal</Pill>
                    )}
                    <form action={deleteMealAction.bind(null, meal.id, plan.id)}>
                      <button
                        type="submit"
                        className="rounded-sm border border-red-400/40 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-red-300 transition-colors hover:bg-red-400/10"
                      >
                        Sil
                      </button>
                    </form>
                  </div>
                </div>

                {meal.foods.length === 0 ? (
                  <p className="mt-3 text-xs text-brand-muted">
                    Bu öğünde besin yok.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-brand-border">
                    {meal.foods.map((food) => (
                      <li
                        key={food.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
                      >
                        <div>
                          <span className="text-sm text-brand-white">
                            {food.name}
                          </span>
                          {food.amount && (
                            <span className="ml-2 text-xs text-brand-muted">
                              {food.amount}
                            </span>
                          )}
                          {food.alternatives && (
                            <div className="mt-0.5 text-[0.7rem] text-brand-muted">
                              Alternatif: {food.alternatives}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[0.7rem] text-brand-muted">
                            {food.calories !== null
                              ? `${food.calories} kcal · P${food.proteinG ?? 0} K${food.carbsG ?? 0} Y${food.fatG ?? 0}`
                              : "makro girilmedi"}
                          </span>
                          <form
                            action={deleteFoodAction.bind(null, food.id, plan.id)}
                          >
                            <button
                              type="submit"
                              className="text-[0.6rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-red-300"
                            >
                              Sil
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <AddFoodForm mealId={meal.id} planId={plan.id} />
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Öğün Ekle">
        <AddMealForm planId={plan.id} />
      </PanelCard>

      <PanelCard
        title="Plan Bilgileri"
        description="Sporcu, başlık, hedef ve makro değerleri."
      >
        <PlanForm
          planId={plan.id}
          members={members.map((member) => ({
            id: member.id,
            fullName: member.fullName,
            memberNo: member.memberNo,
          }))}
          defaults={{
            memberId: plan.memberId,
            title: plan.title,
            goal: plan.goal,
            status: plan.status,
            dayType: plan.dayType,
            weekDaysCsv: plan.weekDaysCsv,
            dailyCalories: plan.dailyCalories,
            proteinG: plan.proteinG,
            carbsG: plan.carbsG,
            fatG: plan.fatG,
            notes: plan.notes,
          }}
        />
      </PanelCard>
    </PanelPage>
  );
}
