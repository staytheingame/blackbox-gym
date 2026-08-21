import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import {
  getMemberScorecard,
  getScoreHistory,
  getTrainingLogs,
} from "@/lib/queries/performance";
import { listAttendanceRecords } from "@/lib/queries/slots";
import { summarizeProgress } from "@/domain/performance/progress";
import type { ScorePillars } from "@/domain/performance/types";
import { PanelCard, PanelPage, StatCard } from "@/components/panel/ui";
import { ProgressPanel } from "@/components/panel/ProgressPanel";

export const metadata: Metadata = {
  title: "Performans — BlackBox Panel",
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

  const [scorecard, attendanceRecords, trainingLogs, snapshots] =
    await Promise.all([
      getMemberScorecard(member.id),
      listAttendanceRecords(member.id),
      getTrainingLogs(member.id),
      getScoreHistory(member.id),
    ]);

  const progress = summarizeProgress({
    bookings: attendanceRecords,
    trainingLogs,
    snapshots,
  });

  const pillarEntries = Object.entries(scorecard.pillars) as [
    keyof ScorePillars,
    number,
  ][];

  return (
    <PanelPage
      title="Performans & Gelişim"
      description="Derse devamlılığın, antrenman hacmin ve check-in skorun — üçü birlikte gelişimini gösterir."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Genel Skor"
          value={scorecard.overallScore}
          suffix="/ 100"
        />
        <StatCard
          label="Trend"
          value={trendLabel[scorecard.trend]}
          hint={
            scorecard.trend === "new"
              ? "Karşılaştırmak için ikinci check-in gerekiyor"
              : `Önceki haftaya göre ${scorecard.trendDelta >= 0 ? "+" : ""}${scorecard.trendDelta} puan`
          }
        />
        <StatCard
          label="Ağrı / Sakatlık"
          value={scorecard.sorenessFlag ? "İşaretli" : "Yok"}
          highlight={scorecard.sorenessFlag}
          hint={
            scorecard.sorenessFlag ? "Antrenörünle paylaş" : "Son check-in'e göre"
          }
        />
      </div>

      <ProgressPanel
        progress={progress}
        title="Gelişim Takibi"
        description="Devamlılık, hacim ve skor ayrı ayrı okunur — biri düşerken diğeri yükselebilir."
      />

      <PanelCard title="Skor Bileşenleri">
        <div className="space-y-4">
          {pillarEntries.map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-brand-muted">
                <span>{pillarLabels[key]}</span>
                <span className="text-brand-white">{value}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-surface-2">
                <div
                  className="h-full bg-brand-yellow"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </PanelPage>
  );
}
