import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { getStaffOverview } from "@/lib/queries/staff";
import {
  SLOT_KIND_LABEL,
  countPendingBookings,
  countSlotsNeedingAttendance,
  listSlots,
} from "@/lib/queries/slots";
import { formatDateTR, formatTimeTR, toGymDateKey } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = {
  title: "Genel Bakış — BlackBox Panel",
};

export default async function StaffOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  // Antrenör yalnız kendi sporcularını ve kendi açtığı seansları görür.
  const scope = staffScopeFor(membership, user.id);

  const todayKey = toGymDateKey(new Date());
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [overview, todaySlots, pendingBookings, pendingAttendance] =
    await Promise.all([
      getStaffOverview(scope),
      listSlots(scope, { from: dayStart, to: dayEnd }),
      countPendingBookings(scope),
      countSlotsNeedingAttendance(scope),
    ]);

  const today = todaySlots.filter(
    (slot) => slot.status !== "iptal" && toGymDateKey(slot.startsAt) === todayKey,
  );

  return (
    <PanelPage
      title="Genel Bakış"
      description="Salonun bu haftaki durumu ve aksiyon bekleyen işler."
      action={
        <Link
          href="/personel/uyeler"
          className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
        >
          Yeni Üye Ekle
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Üye"
          value={overview.totalMembers}
          hint={`${overview.activeMembers} aktif`}
        />
        <StatCard
          label="Bekleyen Check-in"
          value={overview.pendingCheckIns}
          highlight={overview.pendingCheckIns > 0}
          hint={
            overview.pendingCheckIns > 0 ? "İncelenmeyi bekliyor" : "Kuyruk boş"
          }
        />
        <StatCard
          label="Bugünkü Ders"
          value={today.length}
          hint={`${today.reduce((sum, slot) => sum + slot.takenSeats, 0)} kayıtlı sporcu`}
        />
        <StatCard
          label="Yoklama Bekleyen"
          value={pendingAttendance}
          highlight={pendingAttendance > 0}
          hint={pendingAttendance > 0 ? "Geçmiş seans" : "Hepsi işaretlendi"}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Katılım İsteği"
          value={pendingBookings}
          highlight={pendingBookings > 0}
          hint="Grup dersi onayı"
        />
        <StatCard
          label="Bu Hafta Check-in"
          value={overview.checkInsThisWeek}
          hint={`${overview.totalMembers} üye içinden`}
        />
        <StatCard
          label="Bu Hafta Antrenman"
          value={overview.trainingLogsThisWeek}
          hint="Loglanan kayıt"
        />
        <StatCard
          label="Aktif Üye"
          value={overview.activeMembers}
          hint="Kayıtlı sporcu"
        />
      </div>

      <PanelCard
        title="Bugünün Dersleri"
        description={
          today.length === 0 ? undefined : `${today.length} seans`
        }
        action={
          <Link
            href="/personel/program"
            className="text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
          >
            Program
          </Link>
        }
      >
        {today.length === 0 ? (
          <EmptyState>
            Bugün için açık saat yok — Ders Programı bölümünden ekleyebilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {today.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm font-semibold text-brand-white">
                    {formatTimeTR(slot.startsAt)}
                  </span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {SLOT_KIND_LABEL[slot.kind] ?? slot.kind} ·{" "}
                    {slot.seats.length === 0
                      ? "boş"
                      : slot.seats.map((seat) => seat.memberName).join(", ")}
                  </span>
                </div>
                <Pill tone={slot.takenSeats >= slot.capacity ? "neutral" : "yellow"}>
                  {slot.takenSeats}/{slot.capacity}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="İnceleme Kuyruğu"
        description="En yeni gönderimler"
        action={
          <Link
            href="/personel/check-inler"
            className="text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
          >
            Tümü
          </Link>
        }
      >
        {overview.pendingPreview.length === 0 ? (
          <EmptyState>Bekleyen check-in yok — kuyruk temiz.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {overview.pendingPreview.map((checkIn) => (
              <li key={checkIn.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/personel/uyeler/${checkIn.memberId}`}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {checkIn.memberName}
                      <span className="ml-2 text-xs text-brand-muted">
                        {checkIn.memberNo}
                      </span>
                    </div>
                    <div className="text-xs text-brand-muted">
                      {formatDateTR(checkIn.weekStart)} haftası ·{" "}
                      {checkIn.answers.completedSessions}/
                      {checkIn.answers.plannedSessions} antrenman
                    </div>
                  </div>
                  {checkIn.answers.sorenessFlag ? (
                    <Pill tone="danger">Ağrı bildirdi</Pill>
                  ) : (
                    <Pill tone="yellow">İncele</Pill>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
