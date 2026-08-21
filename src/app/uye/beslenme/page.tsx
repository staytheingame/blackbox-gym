import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getMemberNutrition } from "@/lib/queries/nutrition";
import {
  DAY_TYPE_LABEL,
  formatWeekDays,
  type DayType,
} from "@/domain/nutrition/plan";
import { formatDayTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { toggleMealAction } from "./actions";

export const metadata: Metadata = { title: "Beslenme — BlackBox" };

/** İşaretler gün içinde değişir; sayfa her istekte hesaplanır. */
export const dynamic = "force-dynamic";

export default async function MemberNutritionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const { plans, compliance } = await getMemberNutrition(member.id);
  const todayPlans = plans.filter((plan) => plan.activeToday);
  const otherPlans = plans.filter((plan) => !plan.activeToday);

  const checkedToday = todayPlans.reduce(
    (sum, plan) => sum + plan.meals.filter((meal) => meal.checkedToday).length,
    0,
  );
  const mealsToday = todayPlans.reduce(
    (sum, plan) => sum + plan.meals.length,
    0,
  );

  return (
    <PanelPage
      title="Beslenme Planım"
      description="Antrenörünün yazdığı öğün listesi. Yediğin öğünü işaretle — antrenörün uyumu buradan görüyor."
    >
      {plans.length === 0 ? (
        <PanelCard title="Plan yok">
          <EmptyState>
            Sana henüz beslenme planı atanmadı. Antrenörünle konuş — sıklet
            hedefin varsa plan işi kolaylaştırır.
          </EmptyState>
        </PanelCard>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard
              label="Bugün"
              value={`${checkedToday}/${mealsToday}`}
              hint={formatDayTR(new Date())}
              highlight={mealsToday > 0 && checkedToday === mealsToday}
            />
            <StatCard
              label="7 Günlük Uyum"
              value={compliance.confidence === "yok" ? "—" : `%${compliance.percent}`}
              hint={
                compliance.confidence === "dusuk"
                  ? "Veri az — birkaç gün daha işaretle"
                  : compliance.label
              }
            />
            <StatCard
              label="Aktif Plan"
              value={plans.length}
              hint={`${todayPlans.length} tanesi bugün geçerli`}
            />
          </div>

          {todayPlans.length === 0 && (
            <PanelCard title="Bugün için plan yok">
              <EmptyState>
                Planların belirli günler için yazılmış; bugün hiçbiri geçerli
                değil. Aşağıda diğer günlerin planlarını görebilirsin.
              </EmptyState>
            </PanelCard>
          )}

          {[...todayPlans, ...otherPlans].map((plan) => (
            <PanelCard
              key={plan.id}
              title={plan.title}
              description={
                plan.goal
                  ? `${plan.goal} · ${formatWeekDays(plan.weekDaysCsv)}`
                  : formatWeekDays(plan.weekDaysCsv)
              }
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {plan.activeToday ? (
                    <Pill tone="yellow">Bugün</Pill>
                  ) : (
                    <Pill>Diğer günler</Pill>
                  )}
                  {plan.dayType && (
                    <Pill>{DAY_TYPE_LABEL[plan.dayType as DayType]}</Pill>
                  )}
                  {plan.dailyCalories && <Pill>{plan.dailyCalories} kcal</Pill>}
                </div>
              }
            >
              {plan.notes && (
                <p className="mb-4 rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 px-3 py-2 text-xs leading-relaxed text-brand-white">
                  {plan.notes}
                </p>
              )}

              {plan.meals.length === 0 ? (
                <EmptyState>Bu planda henüz öğün yok.</EmptyState>
              ) : (
                <div className="space-y-4">
                  {plan.meals.map((meal) => (
                    <div
                      key={meal.id}
                      className={`rounded-sm border p-4 ${
                        meal.checkedToday
                          ? "border-brand-yellow/40 bg-brand-yellow/5"
                          : "border-brand-border bg-brand-surface-2"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm uppercase tracking-wide text-brand-yellow">
                            {meal.title}
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

                        {plan.activeToday && (
                          <form action={toggleMealAction.bind(null, meal.id)}>
                            <button
                              type="submit"
                              className={`rounded-sm px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide transition-colors ${
                                meal.checkedToday
                                  ? "border border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10"
                                  : "bg-brand-yellow text-brand-black hover:bg-brand-white"
                              }`}
                            >
                              {meal.checkedToday ? "Geri Al" : "Yedim"}
                            </button>
                          </form>
                        )}
                      </div>

                      {meal.foods.length === 0 ? (
                        <p className="mt-3 text-xs text-brand-muted">
                          Bu öğünde besin yazılmamış.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {meal.foods.map((food) => (
                            <li key={food.id} className="text-sm">
                              <span className="text-brand-white">
                                {food.name}
                              </span>
                              {food.amount && (
                                <span className="ml-2 text-xs text-brand-muted">
                                  {food.amount}
                                </span>
                              )}
                              {food.calories !== null && (
                                <span className="ml-2 text-[0.7rem] text-brand-muted">
                                  {food.calories} kcal
                                </span>
                              )}
                              {food.alternatives && (
                                <div className="mt-0.5 text-[0.7rem] text-brand-muted">
                                  Bulamazsan: {food.alternatives}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {meal.totals.hasData && (
                        <div className="mt-3 text-[0.7rem] text-brand-muted">
                          Öğün toplamı: {meal.totals.calories} kcal · P
                          {meal.totals.proteinG} K{meal.totals.carbsG} Y
                          {meal.totals.fatG}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>
          ))}
        </>
      )}
    </PanelPage>
  );
}
