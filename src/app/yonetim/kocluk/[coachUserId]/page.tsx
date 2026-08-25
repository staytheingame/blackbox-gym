import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { getCoachDetail } from "@/lib/queries/coaching";
import { getCoachEarningSummaries } from "@/lib/queries/finance";
import { describeCompensation } from "@/domain/finance/earnings";
import { formatMinorTR } from "@/domain/finance/money";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { formatDateTR } from "@/lib/date";
import { countByBand, RADAR_BAND_LABEL } from "@/domain/analysis/member-radar";
import { RadarList } from "@/components/panel/RadarList";
import {
  CoachAttentionList,
  CoachScorecardStats,
  CoachStatePill,
} from "@/components/panel/CoachScorecardPanel";
import { PeriodNav, resolvePeriod } from "@/components/panel/PeriodNav";
import { PanelCard, PanelPage, Pill, StatCard } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Antrenör Karnesi — BlackBox" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

/**
 * Tek antrenörün karnesi: dönem sayıları, bekleyen işler ve sorumlu olduğu
 * sporcuların radar dökümü. "Bu antrenöre nasıl yardım ederim" ekranı.
 */
export default async function AdminCoachDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ coachUserId: string }>;
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const { coachUserId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const detail = await getCoachDetail(
    membership.organizationId,
    coachUserId,
    period,
  );
  if (!detail) notFound();

  const { row, members } = detail;

  // Hakediş ayrı bir ekranın konusu; burada yalnız "bu dönem ne doğdu,
  // ne kadarı ödenmedi" özeti duruyor ki iki ekran arasında gidip gelinmesin.
  const [earnings] = await getCoachEarningSummaries(
    membership.organizationId,
    period,
    { coachUserId },
  );

  const bands = countByBand(members.map((member) => member.radar));

  return (
    <PanelPage
      title={row.displayName}
      description={`${row.email} · ${ORG_ROLE_LABEL[row.role]} · katılım ${formatDateTR(row.joinedAt)}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/yonetim/kocluk" className={linkClass}>
            Koçluk
          </Link>
          <Link href="/yonetim/kadro" className={linkClass}>
            Hakediş Ayarı
          </Link>
        </div>
      }
    >
      <PeriodNav
        basePath={`/yonetim/kocluk/${coachUserId}`}
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="flex flex-wrap items-center gap-2">
        <CoachStatePill state={row.scorecard.state} />
        {!row.isActive && <Pill tone="danger">Hesap kapalı</Pill>}
        <Pill>{describeCompensation(earnings?.compensation)}</Pill>
      </div>

      <CoachScorecardStats row={row} periodLabel={period.label} />

      <PanelCard
        title="Bekleyen İşler"
        description="Sırayla kapatılacak maddeler. Her maddede sayının nereden geldiği ve ne yapılacağı yazılı."
      >
        <CoachAttentionList
          items={row.scorecard.attention}
          empty={
            row.isActive
              ? "Bekleyen iş yok — yoklama ve kontrol kuyrukları temiz."
              : "Hesap kapalı olduğu için iş listesi üretilmiyor."
          }
        />
      </PanelCard>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dönem Hakedişi"
          value={formatMinorTR(earnings?.totalMinor ?? 0)}
          hint={period.label}
        />
        <StatCard
          label="Ödenmemiş"
          value={formatMinorTR(earnings?.outstandingMinor ?? 0)}
          highlight={(earnings?.outstandingMinor ?? 0) > 0}
          hint="Tüm zamanlar"
        />
        <StatCard
          label="Sporcu Başına Ders"
          value={row.scorecard.sessionsPerMember ?? "—"}
          hint={
            row.scorecard.sessionsPerMember === null
              ? "Aktif sporcusu yok"
              : period.label
          }
        />
        <StatCard
          label="Kota Kullanımı"
          value={
            row.scorecard.quotaUsage === null
              ? "—"
              : `%${row.scorecard.quotaUsage}`
          }
          hint={
            row.monthlySessionQuota === null
              ? "Sözleşmede kota yok"
              : `${row.sessionsHeld}/${row.monthlySessionQuota} ders`
          }
        />
      </div>

      <PanelCard
        title={`Sorumlu Olduğu Sporcular (${members.length})`}
        description={`${bands.kritik} ${RADAR_BAND_LABEL.kritik.toLocaleLowerCase("tr-TR")} · ${bands.izle} ${RADAR_BAND_LABEL.izle.toLocaleLowerCase("tr-TR")} · ${bands.yeni} yeni · ${bands.yolunda} yolunda`}
        action={
          <Link href="/personel/icgoruler" className={linkClass}>
            Takip Radarı
          </Link>
        }
      >
        <RadarList
          rows={members}
          empty={
            row.portfolio === 0
              ? "Bu antrenöre sporcu atanmamış — panelinde hiçbir sporcu görünmez."
              : "Bu antrenörün aktif sporcusu yok (portföyündeki kayıtlar aday ya da pasif)."
          }
        />
      </PanelCard>
    </PanelPage>
  );
}
