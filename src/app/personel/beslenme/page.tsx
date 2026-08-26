import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listMembers } from "@/lib/queries/staff";
import { listOrganizationPlans } from "@/lib/queries/nutrition";
import {
  DAY_TYPE_LABEL,
  NUTRITION_STATUS_LABEL,
  formatWeekDays,
  type DayType,
  type NutritionStatus,
} from "@/domain/nutrition/plan";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { PlanForm } from "./PlanForm";
import { rowNameLinkClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Beslenme — BlackBox Panel" };

export default async function StaffNutritionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);
  const scope = staffScopeFor(membership, user.id);

  const [plans, members] = await Promise.all([
    listOrganizationPlans(scope),
    listMembers(scope),
  ]);

  const active = plans.filter((plan) => plan.status === "aktif");
  const drafts = plans.filter((plan) => plan.status === "taslak");
  const membersWithPlan = new Set(active.map((plan) => plan.memberId));

  return (
    <PanelPage
      title="Beslenme Planları"
      description="Sporcuya özel öğün listeleri. Kalori ve makro alanları opsiyonel — sıklet düşen sporcuda doldur, diğerlerinde 'ne yesin' listesi yeterli."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktif Plan" value={active.length} />
        <StatCard label="Taslak" value={drafts.length} hint="Sporcu görmüyor" />
        <StatCard
          label="Planlı Sporcu"
          value={membersWithPlan.size}
          suffix={`/ ${members.length}`}
        />
        <StatCard
          label="Plansız Sporcu"
          value={members.length - membersWithPlan.size}
          highlight={members.length - membersWithPlan.size > 0}
        />
      </div>

      <PanelCard
        title="Yeni Plan"
        description="Planı oluşturduktan sonra öğünleri ve besinleri plan sayfasında ekleyeceksin."
      >
        {members.length === 0 ? (
          <EmptyState>
            Önce sporcu eklemelisin —{" "}
            <Link
              href="/personel/uyeler"
              className="font-semibold text-brand-yellow hover:underline"
            >
              Sporcular
            </Link>
          </EmptyState>
        ) : (
          <PlanForm
            members={members.map((member) => ({
              id: member.id,
              fullName: member.fullName,
              memberNo: member.memberNo,
            }))}
          />
        )}
      </PanelCard>

      <PanelCard title={`Planlar (${plans.length})`}>
        {plans.length === 0 ? (
          <EmptyState>
            Henüz beslenme planı yok. Yukarıdaki formdan ilk planı oluştur.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/personel/beslenme/${plan.id}`}
                    className={rowNameLinkClass}
                  >
                    {plan.title}
                  </Link>
                  <div className="mt-1 text-xs text-brand-muted">
                    {plan.memberName}{" "}
                    <span className="opacity-70">{plan.memberNo}</span> ·{" "}
                    {plan.mealCount} öğün · {formatWeekDays(plan.weekDaysCsv)}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    Son güncelleme: {formatDateTR(plan.updatedAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {plan.dayType && (
                    <Pill>{DAY_TYPE_LABEL[plan.dayType as DayType]}</Pill>
                  )}
                  {plan.dailyCalories && (
                    <Pill>{plan.dailyCalories} kcal</Pill>
                  )}
                  <Pill tone={plan.status === "aktif" ? "yellow" : "neutral"}>
                    {NUTRITION_STATUS_LABEL[plan.status as NutritionStatus] ??
                      plan.status}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
