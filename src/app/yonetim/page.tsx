import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import { getAdminOverview } from "@/lib/queries/admin";
import { getOccupancyReport } from "@/lib/queries/analysis";
import { getMemberRadarBoard } from "@/lib/queries/radar";
import { RADAR_BAND_LABEL } from "@/domain/analysis/member-radar";
import { RadarList } from "@/components/panel/RadarList";
import { PanelCard, PanelPage, StatCard } from "@/components/panel/ui";
import { EmptyState } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Yönetim — BlackBox" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  // Yönetici salonun tamamını görür.
  const scope = organizationScope(membership.organizationId);

  const [overview, occupancy, radar] = await Promise.all([
    getAdminOverview(membership.organizationId),
    getOccupancyReport(membership.organizationId, 30),
    getMemberRadarBoard(scope),
  ]);

  // Genel bakışta yalnız kritik bant görünür; tam liste Takip Radarı'nda.
  const atRisk = radar.rows.filter((row) => row.radar.band === "kritik");

  return (
    <PanelPage
      title={overview.organizationName}
      description="Salonun işletme görünümü: kadro, üyelik, doluluk ve bildirim akışı. Günlük antrenör işleri antrenör panelinde."
      action={
        <Link href="/personel" className={linkClass}>
          Antrenör Paneli →
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aktif Sporcu"
          value={overview.activeMemberCount}
          hint={`${overview.memberCount} kayıt · ${overview.leadCount} aday`}
        />
        <StatCard
          label="Aktif Üyelik"
          value={overview.activeSubscriptions}
          hint={`${overview.expiringSoon} tanesi 14 gün içinde bitiyor`}
          highlight={overview.expiringSoon > 0}
        />
        <StatCard
          label="Kadro"
          value={overview.staffCount}
          hint={`${overview.coachCount} antrenör`}
        />
        <StatCard
          label="Davet Bekleyen"
          value={overview.pendingInviteCount}
          highlight={overview.pendingInviteCount > 0}
          hint="Hesabını kurmamış sporcu"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bu Hafta Seans"
          value={overview.slotsThisWeek}
          hint={`${overview.bookingsThisWeek} rezervasyon`}
        />
        <StatCard
          label="30 Gün Doluluk"
          value={`%${occupancy.fillRate}`}
          hint={`${occupancy.bookedSeats}/${occupancy.capacity} kontenjan`}
        />
        <StatCard
          label="Gelme Oranı"
          value={occupancy.showRate === 0 ? "—" : `%${occupancy.showRate}`}
          hint={`${occupancy.attended} geldi · ${occupancy.noShow} gelmedi`}
        />
        <StatCard
          label="7 Günde Bildirim"
          value={overview.notificationsLast7Days}
          hint="Hatırlatma ve uyarılar"
        />
      </div>

      <PanelCard
        title={`${RADAR_BAND_LABEL.kritik} (${atRisk.length})`}
        description="Takip radarının kritik bandı. Puan sporcunun notu değil — bugün kimden başlanacağını söyler."
        action={
          <Link href="/personel/icgoruler" className={linkClass}>
            Takip Radarı
          </Link>
        }
      >
        <RadarList
          rows={atRisk.slice(0, 8)}
          showCoach
          empty="Kritik banda düşen sporcu yok. Devamlılık iyi görünüyor."
        />
        {atRisk.length > 8 && (
          <Link
            href="/personel/icgoruler?bant=kritik"
            className="mt-4 inline-block text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
          >
            +{atRisk.length - 8} sporcu daha →
          </Link>
        )}
      </PanelCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard
          title="Saatlere Göre Doluluk"
          description="Son 30 gün · hangi saatler tutuyor"
        >
          {occupancy.byHour.length === 0 ? (
            <EmptyState>Bu dönemde seans kaydı yok.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {occupancy.byHour.map((row) => {
                const max = Math.max(
                  ...occupancy.byHour.map((item) => item.seats),
                  1,
                );
                return (
                  <li key={row.hour} className="flex items-center gap-3">
                    <span className="w-12 text-xs text-brand-muted">
                      {String(row.hour).padStart(2, "0")}:00
                    </span>
                    <div className="h-2 flex-1 rounded-sm bg-brand-surface-2">
                      <div
                        className="h-full rounded-sm bg-brand-yellow"
                        style={{ width: `${(row.seats / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs text-brand-muted">
                      {row.seats} kişi / {row.slots} seans
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Hızlı Erişim">
          <div className="flex flex-wrap gap-2">
            <Link href="/yonetim/kadro" className={linkClass}>
              Kadro
            </Link>
            <Link href="/yonetim/kocluk" className={linkClass}>
              Koçluk ({overview.coachCount} antrenör)
            </Link>
            <Link href="/yonetim/uyeler" className={linkClass}>
              Sporcular
            </Link>
            <Link href="/yonetim/paketler" className={linkClass}>
              Paketler ({overview.activePlanCount}/{overview.planCount})
            </Link>
            <Link href="/yonetim/raporlar" className={linkClass}>
              Raporlar
            </Link>
            <Link href="/yonetim/bildirimler" className={linkClass}>
              Bildirimler
            </Link>
            <Link href="/personel/beslenme" className={linkClass}>
              Beslenme ({overview.nutritionPlanCount} aktif)
            </Link>
          </div>
        </PanelCard>
      </div>
    </PanelPage>
  );
}

