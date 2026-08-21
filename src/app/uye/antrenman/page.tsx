import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getTrainingLogs } from "@/lib/queries/performance";
import { PLAN_LEVEL_LABEL, getActiveMemberPlan } from "@/lib/queries/plans";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
} from "@/components/panel/ui";
import {
  PlanFinishedNotice,
  PlanWeekDays,
  PlanWeekStats,
} from "@/components/panel/PlanWeek";
import { TrainingLogForm } from "./TrainingLogForm";
import { togglePlanDayAction } from "./actions";

export const metadata: Metadata = {
  title: "Programım — BlackBox Panel",
};

const typeLabels: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
};

export default async function TrainingLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [logs, plan] = await Promise.all([
    getTrainingLogs(member.id),
    getActiveMemberPlan(member.id, "antrenman"),
  ]);

  return (
    <PanelPage
      title="Programım"
      description="Antrenörünün atadığı haftalık program ve antrenman geçmişin."
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
        <PanelCard title="Program">
          <EmptyState>
            Sana henüz program atanmadı — antrenörün Planlar bölümünden bir
            şablon atadığında bu ekran dolacak.
          </EmptyState>
        </PanelCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <PanelCard title="Yeni Kayıt">
          <TrainingLogForm />
        </PanelCard>

        <PanelCard title={`Geçmiş (${logs.length})`}>
          {logs.length === 0 ? (
            <EmptyState>Henüz antrenman kaydın yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-brand-border">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <span className="text-sm font-semibold text-brand-white">
                      {typeLabels[log.type] ?? log.type}
                    </span>
                    <span className="ml-2 text-xs text-brand-muted">
                      {formatDateTR(log.loggedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-brand-muted">
                    {log.durationMinutes} dk
                    {log.rounds ? ` · ${log.rounds} round` : ""} · RPE{" "}
                    {log.intensity}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </PanelPage>
  );
}
