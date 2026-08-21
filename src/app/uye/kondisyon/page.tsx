import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getTrainingLogs } from "@/lib/queries/performance";
import { PLAN_LEVEL_LABEL, getActiveMemberPlan } from "@/lib/queries/plans";
import { formatDateTR, getWeekStartInstant } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  PlanFinishedNotice,
  PlanWeekDays,
  PlanWeekStats,
} from "@/components/panel/PlanWeek";
import { togglePlanDayAction } from "../antrenman/actions";

export const metadata: Metadata = { title: "Kondisyon — BlackBox Panel" };

export default async function MemberConditioningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [plan, logs] = await Promise.all([
    getActiveMemberPlan(member.id, "kondisyon"),
    getTrainingLogs(member.id),
  ]);

  const conditioningLogs = logs.filter((log) => log.type === "kondisyon");
  const weekStartedAt = getWeekStartInstant(new Date());
  const thisWeekMinutes = conditioningLogs
    .filter((log) => log.loggedAt >= weekStartedAt)
    .reduce((sum, log) => sum + log.durationMinutes, 0);

  return (
    <PanelPage
      title="Kondisyon Programım"
      description="Antrenörünün sana atadığı koşu, ip ve interval seansları."
      action={
        plan ? (
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="yellow">
              {plan.currentWeek}. hafta / {plan.totalWeeks}
            </Pill>
            <Pill>{PLAN_LEVEL_LABEL[plan.level] ?? plan.level}</Pill>
          </div>
        ) : undefined
      }
    >
      {plan ? (
        <>
          <PlanWeekStats plan={plan} />
          {plan.finished && <PlanFinishedNotice />}
          <PlanWeekDays plan={plan} toggleDay={togglePlanDayAction} />
        </>
      ) : (
        <PanelCard title="Kondisyon Programı">
          <EmptyState>
            Sana ayrı bir kondisyon programı atanmadı. Antrenörün Planlar →
            Kondisyon bölümünden bir şablon atadığında bu ekran dolar —
            antrenman programın etkilenmez, ikisi birlikte yürür.
          </EmptyState>
        </PanelCard>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard
          label="Bu Hafta Kondisyon"
          value={thisWeekMinutes}
          suffix="dk"
          hint="Pazartesi 00:00'dan beri"
        />
        <StatCard
          label="Toplam Seans"
          value={conditioningLogs.length}
          hint="Kondisyon tipli kayıtlar"
        />
      </div>

      <PanelCard
        title={`Kondisyon Geçmişi (${conditioningLogs.length})`}
        description="Programdan tamamladığın günler ve elle girdiğin kondisyon kayıtları."
      >
        {conditioningLogs.length === 0 ? (
          <EmptyState>
            Henüz kondisyon kaydın yok — program gününü tamamladığında ya da
            Programım ekranından &quot;Kondisyon&quot; tipiyle kayıt
            girdiğinde burada listelenir.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {conditioningLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm font-semibold text-brand-white">
                    {log.durationMinutes} dk
                  </span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {formatDateTR(log.loggedAt)}
                  </span>
                  {log.notes && (
                    <div className="text-xs italic text-brand-muted">
                      {log.notes}
                    </div>
                  )}
                </div>
                <div className="text-xs text-brand-muted">
                  {log.rounds ? `${log.rounds} round · ` : ""}RPE {log.intensity}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
