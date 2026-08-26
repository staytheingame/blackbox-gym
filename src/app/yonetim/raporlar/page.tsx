import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import { getOccupancyReport } from "@/lib/queries/analysis";
import { getMembershipOverview } from "@/lib/queries/memberships";
import { getMembershipBreakdown } from "@/lib/queries/staff";
import { WEEKDAY_LABEL } from "@/domain/nutrition/plan";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  activeChipClass,
  rowNameLinkClass,
  secondaryButtonClass,
} from "@/components/panel/form";

export const metadata: Metadata = { title: "Raporlar — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

/** Yatay çubuk — grafik kütüphanesi yok, oran okunacak kadar basit. */
function Bar({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-brand-muted">{label}</span>
      <div className="h-2 flex-1 rounded-sm bg-brand-surface-2">
        <div
          className="h-full rounded-sm bg-brand-yellow"
          style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs text-brand-muted">
        {value} {suffix}
      </span>
    </li>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>;
}) {
  const { gun } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  // Yönetici salonun tamamını görür.
  const scope = organizationScope(membership.organizationId);

  const days = RANGES.includes(Number(gun) as (typeof RANGES)[number])
    ? Number(gun)
    : 30;

  const [occupancy, overview, breakdown] = await Promise.all([
    getOccupancyReport(membership.organizationId, days),
    getMembershipOverview(scope),
    getMembershipBreakdown(scope),
  ]);

  const maxHourSeats = Math.max(
    ...occupancy.byHour.map((row) => row.seats),
    1,
  );
  const maxDaySeats = Math.max(
    ...occupancy.byWeekday.map((row) => row.seats),
    1,
  );

  const emptySeats = occupancy.capacity - occupancy.bookedSeats;

  return (
    <PanelPage
      title="Raporlar"
      description="Doluluk, devamlılık ve üyelik dökümü. Sayılar geçmiş seanslardan gelir; iptal edilen seanslar hesaba katılmaz."
      action={
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`/yonetim/raporlar?gun=${range}`}
              className={range === days ? activeChipClass : secondaryButtonClass}
            >
              {range} gün
            </Link>
          ))}
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Açılan Seans"
          value={occupancy.totalSlots}
          hint={`Son ${days} gün`}
        />
        <StatCard
          label="Doluluk"
          value={`%${occupancy.fillRate}`}
          hint={`${occupancy.bookedSeats}/${occupancy.capacity} kontenjan`}
          highlight={occupancy.fillRate >= 70}
        />
        <StatCard
          label="Boş Kalan Yer"
          value={emptySeats < 0 ? 0 : emptySeats}
          highlight={emptySeats > occupancy.bookedSeats}
          hint="Açılıp dolmayan kontenjan"
        />
        <StatCard
          label="Gelme Oranı"
          value={occupancy.showRate === 0 ? "—" : `%${occupancy.showRate}`}
          hint={`${occupancy.attended} geldi · ${occupancy.noShow} gelmedi`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard
          title="Saatlere Göre"
          description="Hangi saatlerde kaç sporcu geliyor"
        >
          {occupancy.byHour.length === 0 ? (
            <EmptyState>Bu dönemde seans kaydı yok.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {occupancy.byHour.map((row) => (
                <Bar
                  key={row.hour}
                  label={`${String(row.hour).padStart(2, "0")}:00`}
                  value={row.seats}
                  max={maxHourSeats}
                  suffix={`kişi / ${row.slots} seans`}
                />
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Günlere Göre" description="Haftanın hangi günü yoğun">
          {occupancy.byWeekday.length === 0 ? (
            <EmptyState>Bu dönemde seans kaydı yok.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {occupancy.byWeekday.map((row) => (
                <Bar
                  key={row.weekday}
                  label={WEEKDAY_LABEL[row.weekday]}
                  value={row.seats}
                  max={maxDaySeats}
                  suffix={`kişi / ${row.slots} seans`}
                />
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Üyelik Dökümü"
        action={
          <Link href="/personel/uyelikler" className={secondaryButtonClass}>
            Üyelikleri Yönet
          </Link>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Aktif Üyelik" value={overview.activeCount} />
          <StatCard
            label="Süresi Bitiyor"
            value={overview.expiringSoon}
            highlight={overview.expiringSoon > 0}
            hint="14 gün içinde"
          />
          <StatCard
            label="Ders Hakkı Bitti"
            value={overview.creditsExhausted}
            highlight={overview.creditsExhausted > 0}
          />
          <StatCard
            label="Kapatılmayı Bekleyen"
            value={overview.staleActiveCount}
            highlight={overview.staleActiveCount > 0}
            hint="Süresi dolmuş ama aktif"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {overview.plans.map((plan) => (
            <Pill key={plan.id} tone={plan.isActive ? "neutral" : "danger"}>
              {plan.name}: {plan.activeCount}
            </Pill>
          ))}
        </div>
      </PanelCard>

      <PanelCard
        title={`Sessizleşenler (${breakdown.dormant.length})`}
        description="Kaydı aktif ama 30 gündür antrenman kaydı olmayanlar."
      >
        {breakdown.dormant.length === 0 ? (
          <EmptyState>30 gündür sessiz kalan sporcu yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {breakdown.dormant.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/personel/uyeler/${row.id}/analiz`}
                  className={rowNameLinkClass}
                >
                  {row.fullName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {row.memberNo}
                  </span>
                </Link>
                <span className="text-xs text-brand-muted">
                  {row.lastTrainingAt
                    ? `son antrenman ${row.lastTrainingAt.toLocaleDateString("tr-TR")}`
                    : "hiç antrenman kaydı yok"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
