import {
  COACH_STATE_LABEL,
  type CoachAttention,
  type CoachState,
} from "@/domain/coaching/coach-scorecard";
import type { CoachScoreRow } from "@/lib/queries/coaching";
import { formatMinorTR } from "@/domain/finance/money";
import { EmptyState, Pill, StatCard } from "@/components/panel/ui";

/**
 * Antrenör karnesinin ortak gövdesi — yöneticinin kadro ekranı ve
 * antrenörün kendi "Karnem" ekranı aynı bileşeni basar.
 *
 * DİL: bu panel antrenörü notlandırmaz. Gösterdiği şey masasında bekleyen
 * iş ve portföyünün durumudur (bkz. `domain/coaching/coach-scorecard.ts`).
 * Metinler buna göre yazılmıştır; "başarı", "puan", "sıralama" gibi
 * sözcükler bilinçli olarak kullanılmaz.
 */

const STATE_TONE: Record<CoachState, "neutral" | "yellow" | "danger"> = {
  temiz: "neutral",
  izle: "yellow",
  birikmis: "danger",
};

export function CoachStatePill({ state }: { state: CoachState }) {
  return <Pill tone={STATE_TONE[state]}>{COACH_STATE_LABEL[state]}</Pill>;
}

function attentionTone(
  item: CoachAttention,
): "neutral" | "yellow" | "danger" {
  if (item.severity === "kritik") return "danger";
  if (item.severity === "uyari") return "yellow";
  return "neutral";
}

export function CoachAttentionList({
  items,
  empty = "Bekleyen iş yok — kuyruklar temiz.",
}: {
  items: CoachAttention[];
  empty?: string;
}) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.key}
          className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brand-white">
              {item.label}
            </span>
            <Pill tone={attentionTone(item)}>
              {item.severity === "kritik"
                ? "Öncelikli"
                : item.severity === "uyari"
                  ? "Bu hafta"
                  : "Bilgi"}
            </Pill>
          </div>
          <p className="mt-1 text-xs text-brand-muted">{item.evidence}</p>
          <p className="mt-2 text-xs text-brand-white">{item.action}</p>
        </li>
      ))}
    </ul>
  );
}

/** "—" ile boş oran: veri yetmiyorsa sayı uydurulmaz. */
function percent(value: number | null): string {
  return value === null ? "—" : `%${value}`;
}

export function CoachScorecardStats({
  row,
  periodLabel,
  showMoney = true,
}: {
  row: CoachScoreRow;
  periodLabel: string;
  /** Antrenörün kendi ekranında tahsilat toplamı gizlenebilir. */
  showMoney?: boolean;
}) {
  const { scorecard } = row;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Verilen Ders"
          value={row.sessionsHeld}
          hint={
            row.monthlySessionQuota
              ? `${periodLabel} · kota ${row.monthlySessionQuota}`
              : periodLabel
          }
        />
        <StatCard
          label="Doluluk"
          value={percent(scorecard.fillRate)}
          hint={
            scorecard.fillRate === null
              ? "Oran için yeterli seans yok"
              : `${row.seatsBooked}/${row.capacityOffered} kontenjan`
          }
        />
        <StatCard
          label="Gelme Oranı"
          value={percent(scorecard.showRate)}
          hint={
            scorecard.showRate === null
              ? "Oran için yeterli yoklama yok"
              : `${row.seatsAttended} geldi · ${row.seatsNoShow} gelmedi`
          }
        />
        <StatCard
          label="Sorumlu Sporcu"
          value={row.portfolio}
          hint={`${row.activeMembers} aktif`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Yoklama Bekleyen"
          value={row.attendanceBacklog}
          highlight={row.attendanceBacklog > 0}
          hint="Geçmiş seans, işaretlenmemiş"
        />
        <StatCard
          label="Kontrol Bekleyen"
          value={row.checkInBacklog}
          highlight={row.checkInBacklog > 0}
          hint="İncelenmemiş haftalık kontrol"
        />
        <StatCard
          label="Kritik Sporcu"
          value={row.criticalMembers}
          highlight={row.criticalMembers > 0}
          hint={
            scorecard.riskRatio === null
              ? "Portföy boş"
              : `Portföyün %${Math.round(scorecard.riskRatio * 100)}'i`
          }
        />
        {showMoney ? (
          <StatCard
            label="Sporcularından Tahsilat"
            value={formatMinorTR(row.collectedMinor)}
            hint={periodLabel}
          />
        ) : (
          <StatCard
            label="Yaklaşan Seans"
            value={row.upcomingSlots}
            hint="Açtığı, henüz geçmemiş"
          />
        )}
      </div>
    </>
  );
}
