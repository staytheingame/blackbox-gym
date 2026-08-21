import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getMemberDetail } from "@/lib/queries/staff";
import { getScoreHistory } from "@/lib/queries/performance";
import { computeMemberScorecard } from "@/domain/performance/scorecard";
import type { CheckInAnswers } from "@/domain/performance/types";
import { BADGE_DEFINITIONS, type BadgeKey } from "@/domain/gamification/badges";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { getActiveMemberPlan, listPlanTemplates } from "@/lib/queries/plans";
import { listMemberSubscriptions } from "@/lib/queries/memberships";
import { getWeightSummary } from "@/lib/queries/weight";
import { CUT_STATUS_LABEL } from "@/domain/weight/cut";
import {
  getMembershipCredits,
  listAttendanceRecords,
} from "@/lib/queries/slots";
import { summarizeProgress } from "@/domain/performance/progress";
import { ProgressPanel } from "@/components/panel/ProgressPanel";
import { StaffTrainingLogForm } from "./StaffTrainingLogForm";
import { AssignPlanForm } from "./AssignPlanForm";
import { reviewCheckInAction } from "../../actions";

export const metadata: Metadata = { title: "Üye Detayı — BlackBox Panel" };

const typeLabels: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
};

export default async function StaffMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const detail = await getMemberDetail(id);
  if (!detail || detail.member.organizationId !== membership.organizationId) {
    notFound();
  }

  const { member, checkIns, trainingLogs, points, badgeKeys } = detail;

  const [
    templates,
    activeTraining,
    activeConditioning,
    subscriptions,
    weight,
    credits,
    attendanceRecords,
    snapshots,
  ] = await Promise.all([
    listPlanTemplates(membership.organizationId),
    getActiveMemberPlan(member.id, "antrenman"),
    getActiveMemberPlan(member.id, "kondisyon"),
    listMemberSubscriptions(member.id),
    getWeightSummary(member.id, { limit: 6 }),
    getMembershipCredits(member.id),
    listAttendanceRecords(member.id),
    getScoreHistory(member.id),
  ]);

  const progress = summarizeProgress({
    bookings: attendanceRecords,
    trainingLogs,
    snapshots,
  });
  // Yürürlükteki üyelik `getMembershipCredits`ten gelir (ders hakkıyla
  // birlikte); burada yalnız arkasında sırada kaç dönem beklediğini sayıyoruz.
  const queuedCount = Math.max(
    subscriptions.filter((row) => row.status === "aktif" && row.daysLeft >= 0)
      .length - 1,
    0,
  );
  const currentPlans = [activeTraining, activeConditioning]
    .filter((plan) => plan !== null)
    .map((plan) => ({ kind: plan.kind, templateName: plan.templateName }));
  const scorecard = computeMemberScorecard(
    checkIns
      .map((c) => ({
        weekStart: c.weekStart.toISOString().slice(0, 10),
        answers: JSON.parse(c.answersJson) as CheckInAnswers,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  );

  return (
    <PanelPage
      title={member.fullName}
      description={[member.memberNo, member.email, member.phone]
        .filter(Boolean)
        .join(" · ")}
      action={
        <Link
          href="/personel/uyeler"
          className="rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          Üye Listesi
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Genel Skor"
          value={scorecard.overallScore}
          suffix="/ 100"
        />
        <StatCard label="Toplam Puan" value={points} />
        <StatCard
          label="Rozet"
          value={badgeKeys.length}
          highlight={scorecard.sorenessFlag}
          hint={scorecard.sorenessFlag ? "Son check-in'de ağrı bildirdi" : undefined}
        />
      </div>

      {badgeKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badgeKeys.map((key: BadgeKey) => (
            <Pill key={key} tone="yellow" title={BADGE_DEFINITIONS[key].description}>
              {BADGE_DEFINITIONS[key].name}
            </Pill>
          ))}
        </div>
      )}

      <ProgressPanel
        progress={progress}
        title="Gelişim"
        description="Derse geliyor mu, hacmi artıyor mu, skoru ne yönde — üçü ayrı okunur."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard
          title="Üyelik & Ders Hakkı"
          description="Başlatma ve yenileme Yönetim → Üyelikler ekranında."
          action={
            <Link
              href="/personel/uyelikler"
              className="text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-brand-yellow"
            >
              Üyelikler →
            </Link>
          }
        >
          {credits ? (
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-brand-white">
                {credits.planName}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDateTR(credits.startDate)} –{" "}
                {formatDateTR(credits.endDate)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone={credits.daysLeft <= 14 ? "danger" : "yellow"}>
                  {credits.daysLeft} gün kaldı
                </Pill>
                <Pill tone={credits.remaining === 0 ? "danger" : "neutral"}>
                  {credits.unlimited
                    ? "Sınırsız ders"
                    : `${credits.remaining} ders kaldı`}
                </Pill>
                {credits.reserved > 0 && (
                  <Pill>{credits.reserved} rezerve</Pill>
                )}
                {queuedCount > 0 && <Pill>Sırada {queuedCount} dönem</Pill>}
              </div>
            </div>
          ) : (
            <EmptyState>
              Yürürlükte üyelik yok
              {subscriptions.length > 0
                ? ` — ${subscriptions.length} geçmiş kayıt var.`
                : "."}
            </EmptyState>
          )}
        </PanelCard>

        <PanelCard
          title="Tartı & Sıklet"
          description="Tartı girişi Planlar → Tartı ekranından yapılır."
          action={
            <Link
              href="/personel/tarti"
              className="text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-brand-yellow"
            >
              Tartı →
            </Link>
          }
        >
          {weight.latestKg === null ? (
            <EmptyState>Henüz tartı kaydı yok.</EmptyState>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="font-display text-2xl text-brand-white">
                {weight.latestKg} kg
              </div>
              <div className="text-xs text-brand-muted">
                {weight.entries[0]
                  ? formatDateTR(weight.entries[0].takenAt)
                  : ""}
                {weight.goal ? ` · hedef ${weight.goal.targetKg} kg` : ""}
                {weight.trendKgPerWeek !== null
                  ? ` · ${weight.trendKgPerWeek > 0 ? "+" : ""}${weight.trendKgPerWeek} kg/hafta`
                  : ""}
              </div>
              {weight.cut && (
                <Pill
                  tone={
                    weight.cut.status === "riskli" ||
                    weight.cut.status === "imkansiz"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {CUT_STATUS_LABEL[weight.cut.status]}
                </Pill>
              )}
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Program Ata"
        description="Şablonu atadığında sporcunun 'Programım' ekranı bu haftadan itibaren dolar. Antrenman ve kondisyon programı ayrı yürür."
      >
        <AssignPlanForm
          memberId={member.id}
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            kind: template.kind,
            weeks: template.weeks,
          }))}
          currentPlans={currentPlans}
        />
      </PanelCard>

      <PanelCard title="Antrenman Logla">
        <StaffTrainingLogForm memberId={member.id} />
      </PanelCard>

      <PanelCard title={`Check-in Geçmişi (${checkIns.length})`}>
        {checkIns.length === 0 ? (
          <EmptyState>Henüz check-in yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {checkIns.map((checkIn) => {
              const answers = JSON.parse(checkIn.answersJson) as CheckInAnswers;
              return (
                <li
                  key={checkIn.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {formatDateTR(checkIn.weekStart)} haftası
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {answers.completedSessions}/{answers.plannedSessions}{" "}
                      antrenman · uyku {answers.sleepQuality}/5 · stres{" "}
                      {answers.stressLevel}/5 · enerji {answers.energyLevel}/5
                    </div>
                    {answers.note && (
                      <p className="mt-2 max-w-xl text-xs italic text-brand-muted">
                        “{answers.note}”
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {answers.sorenessFlag && <Pill tone="danger">Ağrı</Pill>}
                    {checkIn.status === "reviewed" ? (
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                        İncelendi
                      </span>
                    ) : (
                      <form
                        action={reviewCheckInAction.bind(
                          null,
                          checkIn.id,
                          member.id,
                        )}
                      >
                        <button
                          type="submit"
                          className="rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black"
                        >
                          İncelendi İşaretle
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard title={`Antrenman Geçmişi (${trainingLogs.length})`}>
        {trainingLogs.length === 0 ? (
          <EmptyState>Henüz antrenman kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {trainingLogs.map((log) => (
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
    </PanelPage>
  );
}
