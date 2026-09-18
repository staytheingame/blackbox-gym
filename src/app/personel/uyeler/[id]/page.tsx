import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
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
import { getMemberRankState } from "@/lib/queries/ranks";
import { getMemberWaivers } from "@/lib/queries/waivers";
import { getMemberFinance } from "@/lib/queries/finance";
import { getMemberPersonalInfo } from "@/lib/queries/member-profile";
import { ageFrom } from "@/domain/marketing/meta-matching";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/ledger";
import { summarizeDue, DUE_STATUS_LABEL } from "@/domain/finance/dues";
import { formatMinorTR } from "@/domain/finance/money";
import { WAIVER_STATE_LABEL } from "@/domain/waivers/status";
import { StaffTrainingLogForm } from "./StaffTrainingLogForm";
import { AssignPlanForm } from "./AssignPlanForm";
import { reviewCheckInAction } from "../../actions";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/panel/form";

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

  const scope = staffScopeFor(membership, user.id);

  const detail = await getMemberDetail(id);
  if (!detail || detail.member.organizationId !== membership.organizationId) {
    notFound();
  }
  // Antrenör yalnız kendi sporcusunun detayını açabilir (yönetici hepsini).
  if (
    scope.coachUserId &&
    detail.member.assignedCoachUserId !== scope.coachUserId
  ) {
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
    rankState,
    waivers,
    finance,
    personal,
  ] = await Promise.all([
    listPlanTemplates(membership.organizationId),
    getActiveMemberPlan(member.id, "antrenman"),
    getActiveMemberPlan(member.id, "kondisyon"),
    listMemberSubscriptions(member.id),
    getWeightSummary(member.id, { limit: 6 }),
    getMembershipCredits(member.id),
    listAttendanceRecords(member.id),
    getScoreHistory(member.id),
    getMemberRankState(member.id, membership.organizationId),
    getMemberWaivers(member.id, membership.organizationId),
    getMemberFinance(member.id),
    getMemberPersonalInfo(member.id),
  ]);

  // Beyanında "evet" işaretlenmiş maddeler — yüklenme kararından ÖNCE görülmeli.
  const healthNotes = waivers.signatures
    .map((signature) => signature.healthNote)
    .filter((note): note is string => Boolean(note));

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/personel/uyeler/${member.id}/analiz`}
            className={primaryButtonClass}
          >
            Analiz
          </Link>
          <Link
            href="/personel/beslenme"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-9"
          >
            Beslenme
          </Link>
          <Link
            href="/personel/uyeler"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-9"
          >
            Üye Listesi
          </Link>
        </div>
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

      {personal && (
        <PanelCard
          title="Kişisel Bilgiler"
          description={
            personal.missing.length > 0
              ? `Eksik: ${personal.missing.join(", ")}. Sporcu kendi profilinden doldurabilir.`
              : "Sporcunun kendi girdiği bilgiler. Sağlık notunu seans öncesi oku."
          }
        >
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              { label: "Telefon", value: personal.phone },
              { label: "E-posta", value: personal.email ?? "" },
              {
                label: "Yaş",
                value: (() => {
                  const age = ageFrom(
                    personal.birthDate ? new Date(personal.birthDate) : null,
                  );
                  return age === null ? "" : `${age}`;
                })(),
              },
              {
                label: "Yaşadığı yer",
                value: [personal.district, personal.city]
                  .filter(Boolean)
                  .join(" · "),
              },
              {
                label: "Acil durum",
                value: [personal.emergencyName, personal.emergencyPhone]
                  .filter(Boolean)
                  .join(" · "),
              },
              { label: "Posta kodu", value: personal.postalCode ?? "" },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline gap-2">
                <dt className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-brand-muted">
                  {row.label}
                </dt>
                <dd className="text-sm text-brand-white">
                  {row.value || <span className="text-brand-muted">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          {personal.healthNote && (
            <p className="mt-4 rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-3 text-sm leading-relaxed text-brand-white">
              <span className="font-bold uppercase tracking-wide text-brand-yellow">
                Sağlık notu:
              </span>{" "}
              {personal.healthNote}
            </p>
          )}
        </PanelCard>
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

      <PanelCard
        title="Ödeme Durumu"
        description="Bu sporcunun üyelik borcu ve tahsilat geçmişi."
        action={
          <Link href="/personel/kasa" className={secondaryButtonClass}>
            Tahsilat Gir →
          </Link>
        }
      >
        {finance.subscriptions.length === 0 ? (
          <EmptyState>Üyelik kaydı yok.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {finance.subscriptions
              .filter((row) => row.priceMinor > 0)
              .map((row) => {
                const due = summarizeDue({
                  priceMinor: row.priceMinor,
                  paidMinor: row.paidMinor,
                  endDate: row.endDate,
                });
                return (
                  <li key={row.id} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-brand-white">
                        {row.planName}
                      </span>
                      <span className="text-xs text-brand-muted">
                        {formatMinorTR(row.paidMinor, row.currency)} /{" "}
                        {formatMinorTR(row.priceMinor, row.currency)}
                      </span>
                    </div>
                    <div className="h-2 rounded-sm bg-brand-surface-2">
                      <div
                        className="h-full rounded-sm bg-brand-yellow"
                        style={{ width: `${Math.round(due.ratio * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-brand-muted">
                      <span>
                        {formatDateTR(row.startDate)} – {formatDateTR(row.endDate)}
                      </span>
                      <span
                        className={
                          due.status === "gecikti"
                            ? "font-semibold text-red-400"
                            : ""
                        }
                      >
                        {DUE_STATUS_LABEL[due.status]}
                        {due.balanceMinor > 0 &&
                          ` · ${formatMinorTR(due.balanceMinor, row.currency)} kaldı`}
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}

        {finance.payments.length > 0 && (
          <ul className="mt-5 divide-y divide-brand-border border-t border-brand-border pt-3">
            {finance.payments.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="text-brand-muted">
                  {formatDateTR(row.paidAt)} ·{" "}
                  {PAYMENT_METHOD_LABEL[row.method]}
                  {row.planName ? ` · ${row.planName}` : ""}
                </span>
                <span className="font-semibold text-brand-white">
                  {formatMinorTR(row.amountMinor, row.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {healthNotes.length > 0 && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          <strong>Sağlık beyanı uyarısı:</strong> {healthNotes.join(" · ")}.
          Yüklenme ve sparring kararını buna göre ver.
        </div>
      )}

      {waivers.pendingCount > 0 && (
        <PanelCard
          title="Onam Eksik"
          description="Sporcu kendi panelinden imzalar; sen buradan hangi formun beklediğini görürsün."
          action={
            <Link
              href="/personel/onaylar"
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-8"
            >
              Formlar
            </Link>
          }
        >
          <ul className="space-y-2">
            {waivers.items
              .filter((item) => item.state !== "imzali")
              .map((item) => (
                <li
                  key={item.templateId}
                  className="flex flex-wrap items-center justify-between gap-3 text-sm text-brand-white"
                >
                  <span>{item.title}</span>
                  <Pill tone={item.state === "eksik" ? "danger" : "yellow"}>
                    {WAIVER_STATE_LABEL[item.state]}
                  </Pill>
                </li>
              ))}
          </ul>
        </PanelCard>
      )}

      {rankState && (
        <PanelCard
          title="Kuşak"
          description={
            rankState.nextRank
              ? `Hedef: ${rankState.nextRank.name}`
              : "Merdivenin sonunda"
          }
          action={
            <Link
              href={`/personel/kusaklar/${member.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-8"
            >
              Müfredat & terfi
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="inline-block h-6 w-6 rounded-sm border border-brand-border"
              style={{
                backgroundColor: rankState.currentRank?.color ?? "transparent",
              }}
            />
            <span className="text-sm text-brand-white">
              {rankState.currentRank?.name ?? "Henüz kuşağı yok"}
            </span>
            {rankState.progress && (
              <>
                <span className="h-1.5 w-28 rounded-sm bg-brand-surface-2">
                  <span
                    className="block h-1.5 rounded-sm bg-brand-yellow"
                    style={{ width: `${rankState.progress.percent}%` }}
                  />
                </span>
                {rankState.progress.ready ? (
                  <Pill tone="yellow">Terfiye hazır</Pill>
                ) : (
                  <Pill>
                    Eksik: {rankState.progress.missing.join(" · ") || "yok"}
                  </Pill>
                )}
              </>
            )}
          </div>
        </PanelCard>
      )}

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
                          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black sm:min-h-8"
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
