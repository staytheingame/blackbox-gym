import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getMemberDetail } from "@/lib/queries/staff";
import { computeMemberScorecard } from "@/domain/performance/scorecard";
import type { CheckInAnswers } from "@/domain/performance/types";
import { BADGE_DEFINITIONS, type BadgeKey } from "@/domain/gamification/badges";
import { formatDateTR } from "@/lib/date";
import { StaffTrainingLogForm } from "./StaffTrainingLogForm";
import { reviewCheckInAction } from "./actions";

export const metadata: Metadata = { title: "Üye Detayı — BlackBox" };

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
  const scorecard = computeMemberScorecard(
    checkIns
      .map((c) => ({
        weekStart: c.weekStart.toISOString().slice(0, 10),
        answers: JSON.parse(c.answersJson) as CheckInAnswers,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  );

  return (
    <div>
      <PageHero
        eyebrow={member.memberNo}
        title={member.fullName}
        description={member.email ?? undefined}
      />
      <section className="mx-auto max-w-5xl space-y-10 px-4 py-14 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard label="Genel Skor" value={scorecard.overallScore} />
          <StatCard label="Toplam Puan" value={points} />
          <StatCard label="Rozet" value={badgeKeys.length} />
        </div>

        {badgeKeys.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {badgeKeys.map((key: BadgeKey) => (
              <span
                key={key}
                title={BADGE_DEFINITIONS[key].description}
                className="rounded-sm border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-white"
              >
                {BADGE_DEFINITIONS[key].name}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-sm border border-brand-border bg-brand-surface p-6">
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Antrenman Logla
          </h2>
          <div className="mt-4">
            <StaffTrainingLogForm memberId={member.id} />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Check-in Geçmişi
          </h2>
          {checkIns.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">Henüz check-in yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
              {checkIns.map((checkIn) => {
                const answers = JSON.parse(
                  checkIn.answersJson,
                ) as CheckInAnswers;
                return (
                  <li
                    key={checkIn.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        Hafta: {formatDateTR(checkIn.weekStart)}
                      </div>
                      <div className="text-xs text-brand-muted">
                        {answers.completedSessions}/{answers.plannedSessions}{" "}
                        antrenman · uyku {answers.sleepQuality}/5 · stres{" "}
                        {answers.stressLevel}/5 · enerji {answers.energyLevel}/5
                        {answers.sorenessFlag && (
                          <span className="ml-2 text-red-400">ağrı bildirdi</span>
                        )}
                      </div>
                    </div>
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
                          className="rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow hover:bg-brand-yellow hover:text-brand-black"
                        >
                          İncelendi İşaretle
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Antrenman Geçmişi
          </h2>
          {trainingLogs.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">
              Henüz antrenman kaydı yok.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
              {trainingLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
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
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-brand-border bg-brand-surface p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-2 text-2xl text-brand-white">{value}</div>
    </div>
  );
}
