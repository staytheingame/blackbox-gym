import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getCoachDetail } from "@/lib/queries/coaching";
import { countByBand, RADAR_BAND_LABEL } from "@/domain/analysis/member-radar";
import { RadarList } from "@/components/panel/RadarList";
import {
  CoachAttentionList,
  CoachScorecardStats,
  CoachStatePill,
} from "@/components/panel/CoachScorecardPanel";
import { PeriodNav, resolvePeriod } from "@/components/panel/PeriodNav";
import { EmptyState, PanelCard, PanelPage } from "@/components/panel/ui";
import { secondaryButtonClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Karnem — BlackBox Panel" };

export const dynamic = "force-dynamic";

/**
 * ANTRENÖRÜN KENDİ KARNESİ.
 *
 * Yöneticinin gördüğü karneyle **aynı sayıları** gösterir; sürpriz olmasın
 * diye. Fark tek yerde: salon geneli tahsilat toplamı yerine antrenörün
 * kendi yaklaşan seansları görünür (para ekranı `/personel/kasa`).
 *
 * Kapsam: yalnız kendi `userId`'siyle çağrılır — başka antrenörün karnesi
 * bu yoldan açılamaz.
 */
export default async function CoachOwnScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const detail = await getCoachDetail(
    membership.organizationId,
    user.id,
    period,
  );

  if (!detail) {
    return (
      <PanelPage
        title="Karnem"
        description="Verdiğin dersler, bekleyen işlerin ve sporcularının durumu."
      >
        <EmptyState>
          Kadro kaydın bulunamadı — yöneticiyle görüş.
        </EmptyState>
      </PanelPage>
    );
  }

  const { row, members } = detail;
  const bands = countByBand(members.map((member) => member.radar));

  return (
    <PanelPage
      title="Karnem"
      description="Verdiğin dersler, masanda bekleyen işler ve sporcularının durumu. Bu sayılar salon yönetiminin gördüğüyle aynıdır."
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/personel/kasa" className={secondaryButtonClass}>
            Hakedişim
          </Link>
          <Link href="/personel/icgoruler" className={secondaryButtonClass}>
            Takip Radarı
          </Link>
        </div>
      }
    >
      <PeriodNav
        basePath="/personel/karne"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="flex flex-wrap items-center gap-2">
        <CoachStatePill state={row.scorecard.state} />
      </div>

      <CoachScorecardStats
        row={row}
        periodLabel={period.label}
        showMoney={false}
      />

      <PanelCard
        title="Bekleyen İşlerim"
        description="Sırayla kapatılacak maddeler — her birinde sayının kaynağı ve yapılacak iş yazılı."
      >
        <CoachAttentionList
          items={row.scorecard.attention}
          empty="Bekleyen iş yok — yoklama ve kontrol kuyruğun temiz."
        />
      </PanelCard>

      <PanelCard
        title={`Sporcularım (${members.length})`}
        description={`${bands.kritik} ${RADAR_BAND_LABEL.kritik.toLocaleLowerCase("tr-TR")} · ${bands.izle} ${RADAR_BAND_LABEL.izle.toLocaleLowerCase("tr-TR")} · ${bands.yeni} yeni · ${bands.yolunda} yolunda`}
      >
        <RadarList
          rows={members}
          empty="Sana atanmış aktif sporcu yok."
        />
      </PanelCard>

      <p className="text-xs leading-relaxed text-brand-muted">
        Doluluk ve gelme oranı tek başına senin belirlediğin sayılar değil —
        saat, sporcunun işi ve mevsim etkiler. Bu ekran bir başarı notu değil,
        bekleyen işin dökümüdür.
      </p>
    </PanelPage>
  );
}
