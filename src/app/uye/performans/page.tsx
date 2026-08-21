import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getMemberScorecard } from "@/lib/queries/performance";
import type { ScorePillars } from "@/domain/performance/types";

export const metadata: Metadata = {
  title: "Performans — BlackBox",
};

const pillarLabels: Record<keyof ScorePillars, string> = {
  training: "Antrenman Uyumu",
  sleep: "Uyku",
  stress: "Stres Yönetimi",
  energy: "Enerji",
  enjoyment: "Keyif",
  consistency: "Tutarlılık (check-in)",
};

const trendLabel: Record<string, string> = {
  up: "Yükseliyor",
  down: "Düşüyor",
  flat: "Sabit",
  new: "Yeni",
};

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const scorecard = await getMemberScorecard(member.id);
  const pillarEntries = Object.entries(scorecard.pillars) as [
    keyof ScorePillars,
    number,
  ][];

  return (
    <div>
      <PageHero
        eyebrow="Performans Kartı"
        title="Skorun"
        description="Check-in cevaplarından hesaplanan performans kartı — antrenman uyumu, uyku, stres, enerji, keyif ve tutarlılık."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-sm border border-brand-border bg-brand-surface p-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Genel Skor
            </span>
            <div className="font-display text-5xl text-brand-yellow">
              {scorecard.overallScore}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Trend
            </span>
            <div className="font-display text-xl text-brand-white">
              {trendLabel[scorecard.trend]}
              {scorecard.trend !== "new" && (
                <span
                  className={
                    scorecard.trendDelta >= 0
                      ? "ml-2 text-sm text-emerald-400"
                      : "ml-2 text-sm text-red-400"
                  }
                >
                  {scorecard.trendDelta >= 0 ? "+" : ""}
                  {scorecard.trendDelta}
                </span>
              )}
            </div>
          </div>
        </div>

        {scorecard.sorenessFlag && (
          <p className="mt-4 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Son check-in&apos;de ağrı/sakatlık işaretlendi — antrenörünle paylaş.
          </p>
        )}

        <div className="mt-8 space-y-4">
          {pillarEntries.map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-brand-muted">
                <span>{pillarLabels[key]}</span>
                <span>{value}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-surface-2">
                <div
                  className="h-full bg-brand-yellow"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
