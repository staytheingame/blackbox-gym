import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getWeightSummary } from "@/lib/queries/weight";
import { CUT_STATUS_LABEL } from "@/domain/weight/cut";
import { weightClassBySlug } from "@/data/weight-classes";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { WeightEntryForm, WeightGoalForm } from "./WeightForms";

export const metadata: Metadata = { title: "Tartı — BlackBox Panel" };

export default async function MemberWeightPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const summary = await getWeightSummary(member.id);
  const weightClass = weightClassBySlug(summary.goal?.weightClass ?? null);
  const cut = summary.cut;

  const trendLabel =
    summary.trendKgPerWeek === null
      ? "—"
      : `${summary.trendKgPerWeek > 0 ? "+" : ""}${summary.trendKgPerWeek} kg`;

  return (
    <PanelPage
      title="Kilo & Tartı Takibim"
      description="Sıklet hedefin, haftalık tartın ve kamp boyunca kilo eğrin."
      action={
        weightClass ? (
          <Pill tone="yellow">
            {weightClass.name}
            {weightClass.maxKg ? ` · ≤ ${weightClass.maxKg} kg` : ""}
          </Pill>
        ) : undefined
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Son Tartı"
          value={summary.latestKg ?? "—"}
          suffix={summary.latestKg ? "kg" : undefined}
          hint={
            summary.entries[0]
              ? formatDateTR(summary.entries[0].takenAt)
              : "Kayıt yok"
          }
        />
        <StatCard
          label="Hedef"
          value={summary.goal?.targetKg ?? "—"}
          suffix={summary.goal ? "kg" : undefined}
          hint={
            summary.goal?.fightDate
              ? `${formatDateTR(summary.goal.fightDate)} tartısı`
              : "Tarih girilmedi"
          }
        />
        <StatCard
          label="Haftalık Trend"
          value={trendLabel}
          hint="Son kayıtlara göre"
        />
        <StatCard
          label="Durum"
          value={cut ? CUT_STATUS_LABEL[cut.status] : "—"}
          highlight={cut?.status === "riskli" || cut?.status === "imkansiz"}
          hint={
            cut?.requiredWeeklyKg
              ? `Gereken: ${cut.requiredWeeklyKg} kg/hafta`
              : undefined
          }
        />
      </div>

      {cut && (cut.status === "riskli" || cut.status === "imkansiz") && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          Hedefe yetişmek için haftada{" "}
          <strong>{cut.requiredWeeklyKg} kg</strong> vermen gerekiyor; güvenli
          üst sınır vücut ağırlığının %1&apos;i, yani{" "}
          <strong>{cut.safeWeeklyKg} kg/hafta</strong>. Antrenörünle konuş —
          hızlı su atma performansı düşürür.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard
          title="Tartı Ekle"
          description="Haftada bir, aynı koşullarda (sabah, aç karnına) ölç."
        >
          <WeightEntryForm />
        </PanelCard>

        <PanelCard title="Sıklet Hedefi">
          <WeightGoalForm
            defaultTargetKg={summary.goal?.targetKg}
            defaultWeightClass={summary.goal?.weightClass}
            defaultFightDate={
              summary.goal?.fightDate
                ? summary.goal.fightDate.toISOString().slice(0, 10)
                : undefined
            }
          />
        </PanelCard>
      </div>

      <PanelCard title={`Tartı Geçmişi (${summary.entries.length})`}>
        {summary.entries.length === 0 ? (
          <EmptyState>Henüz tartı kaydın yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {summary.entries.map((entry, index) => {
              const previous = summary.entries[index + 1];
              const delta = previous
                ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10
                : null;

              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <span className="font-display text-lg text-brand-white">
                      {entry.weightKg} kg
                    </span>
                    <span className="ml-3 text-xs text-brand-muted">
                      {formatDateTR(entry.takenAt)}
                      {entry.bodyFatPercent
                        ? ` · %${entry.bodyFatPercent} yağ`
                        : ""}
                    </span>
                    {entry.note && (
                      <div className="text-xs italic text-brand-muted">
                        {entry.note}
                      </div>
                    )}
                  </div>
                  {delta !== null && (
                    <span
                      className={`text-xs font-semibold ${
                        delta <= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta} kg
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
