import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import {
  getCheckInHistory,
  getMemberScorecard,
  getPointsTotal,
  getBadgeKeys,
} from "@/lib/queries/performance";
import { getWeekStart } from "@/lib/date";
import { BADGE_DEFINITIONS } from "@/domain/gamification/badges";

export default async function MemberDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [history, scorecard, points, badgeKeys] = await Promise.all([
    getCheckInHistory(member.id),
    getMemberScorecard(member.id),
    getPointsTotal(member.id),
    getBadgeKeys(member.id),
  ]);

  const thisWeek = getWeekStart(new Date()).toISOString().slice(0, 10);
  const submittedThisWeek = history.some((h) => h.weekStart === thisWeek);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-brand-white">
        Hoş geldin, {member.fullName}
      </h1>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Genel Skor" value={scorecard.overallScore} suffix="/ 100" />
        <StatCard label="Toplam Puan" value={points} />
        <StatCard label="Rozet" value={badgeKeys.length} />
        <StatCard
          label="Bu Hafta Check-in"
          value={submittedThisWeek ? "Gönderildi" : "Bekliyor"}
          highlight={!submittedThisWeek}
        />
      </div>

      {!submittedThisWeek && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-brand-yellow bg-brand-surface-2 p-5">
          <p className="text-sm text-brand-white">
            Bu haftanın check-in&apos;ini henüz göndermedin.
          </p>
          <Link
            href="/uye/check-in"
            className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white"
          >
            Check-in Gönder
          </Link>
        </div>
      )}

      {badgeKeys.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Rozetlerin
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {badgeKeys.map((key) => (
              <span
                key={key}
                title={BADGE_DEFINITIONS[key].description}
                className="rounded-sm border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-white"
              >
                {BADGE_DEFINITIONS[key].name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-5 ${
        highlight
          ? "border-brand-yellow bg-brand-surface-2"
          : "border-brand-border bg-brand-surface"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-2 text-2xl text-brand-white">
        {value} {suffix && <span className="text-sm text-brand-muted">{suffix}</span>}
      </div>
    </div>
  );
}
