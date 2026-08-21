import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import {
  countConsecutiveWeeks,
  getBadgeKeys,
  getCheckInHistory,
  getLeaderboard,
  getMemberScorecard,
  getPointsTotal,
  getTrainingLogs,
} from "@/lib/queries/performance";
import { formatDateTR, getWeekStart } from "@/lib/date";
import { BADGE_DEFINITIONS } from "@/domain/gamification/badges";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Özet — BlackBox Panel" };

const typeLabels: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
};

export default async function MemberDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const membership = await requireOrganizationMembership(user.id);

  const [history, scorecard, points, badgeKeys, logs, leaderboard] =
    await Promise.all([
      getCheckInHistory(member.id),
      getMemberScorecard(member.id),
      getPointsTotal(member.id),
      getBadgeKeys(member.id),
      getTrainingLogs(member.id),
      getLeaderboard(membership.organizationId),
    ]);

  const thisWeek = getWeekStart(new Date()).toISOString().slice(0, 10);
  const submittedThisWeek = history.some((h) => h.weekStart === thisWeek);
  const streak = countConsecutiveWeeks(history);
  const rankIndex = leaderboard.findIndex((e) => e.memberId === member.id);
  const recentLogs = logs.slice(0, 5);

  return (
    <PanelPage
      title={`Hoş geldin, ${member.fullName.split(" ")[0]}`}
      description="Bu haftanın durumu, performans skorun ve son antrenmanların."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{member.memberNo}</Pill>
          <Pill tone={member.status === "active" ? "yellow" : "neutral"}>
            {member.status === "active" ? "Aktif üyelik" : member.status}
          </Pill>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Genel Skor"
          value={scorecard.overallScore}
          suffix="/ 100"
          hint={
            scorecard.trend === "new"
              ? "İlk check-in'ini bekliyoruz"
              : `Trend: ${scorecard.trendDelta >= 0 ? "+" : ""}${scorecard.trendDelta}`
          }
        />
        <StatCard label="Toplam Puan" value={points} hint={`${badgeKeys.length} rozet`} />
        <StatCard
          label="Lig Sırası"
          value={rankIndex >= 0 ? `#${rankIndex + 1}` : "—"}
          hint={`${leaderboard.length} üye arasında`}
        />
        <StatCard
          label="Check-in Serisi"
          value={streak}
          suffix="hafta"
          hint={submittedThisWeek ? "Bu hafta gönderildi" : "Bu hafta bekliyor"}
          highlight={!submittedThisWeek}
        />
      </div>

      {!submittedThisWeek && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-brand-yellow bg-brand-surface-2 p-5">
          <div>
            <p className="text-sm font-semibold text-brand-white">
              Bu haftanın check-in&apos;i bekliyor.
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              5 soruluk form performans kartını ve puanını günceller.
            </p>
          </div>
          <Link
            href="/uye/check-in"
            className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
          >
            Check-in Gönder
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard
          title="Son Antrenmanlar"
          action={
            <Link
              href="/uye/antrenman"
              className="text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
            >
              Tümü
            </Link>
          }
        >
          {recentLogs.length === 0 ? (
            <EmptyState>Henüz antrenman kaydın yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-brand-border">
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {typeLabels[log.type] ?? log.type}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {formatDateTR(log.loggedAt)}
                    </div>
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

        <PanelCard
          title="Rozetler"
          action={
            <Link
              href="/uye/lig"
              className="text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
            >
              Lig
            </Link>
          }
        >
          {badgeKeys.length === 0 ? (
            <EmptyState>
              Henüz rozet yok — check-in ve antrenman kaydı rozet kazandırır.
            </EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2">
              {badgeKeys.map((key) => (
                <Pill
                  key={key}
                  tone="yellow"
                  title={BADGE_DEFINITIONS[key].description}
                >
                  {BADGE_DEFINITIONS[key].name}
                </Pill>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
    </PanelPage>
  );
}
