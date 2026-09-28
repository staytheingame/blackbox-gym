import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { isOrganizationWide, staffScopeFor } from "@/lib/auth/scope";
import { getDayView, type DayRosterMember } from "@/lib/queries/today";
import { SLOT_KIND_LABEL } from "@/lib/queries/slots";
import { BOOKING_STATUS_LABEL } from "@/domain/booking/credits";
import { formatDayTR, formatTimeTR, toGymDateKey } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  approveRequestAction,
  closeSlotAction,
  markAttendanceAction,
} from "../program/actions";
import { RemindButton } from "./RemindButton";
import {
  rowButtonClass,
  rowNameLinkClass,
  rowPrimaryButtonClass,
} from "@/components/panel/form";

export const metadata: Metadata = { title: "Bugün — BlackBox Panel" };

/** Yoklama ve rezervasyon her an değişir; sayfa istekte hesaplanır. */
export const dynamic = "force-dynamic";

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const civil = new Date(Date.UTC(year, month - 1, day));
  civil.setUTCDate(civil.getUTCDate() + days);
  return civil.toISOString().slice(0, 10);
}

function MemberRow({
  row,
  slotPast,
}: {
  row: DayRosterMember;
  slotPast: boolean;
}) {
  const lowCredits =
    row.sessionsRemaining !== null && row.sessionsRemaining <= 2;
  const expiringSoon =
    row.membershipDaysLeft !== null && row.membershipDaysLeft <= 14;

  return (
    <li className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          href={`/personel/uyeler/${row.memberId}`}
          className={rowNameLinkClass}
        >
          {row.fullName}
        </Link>
        <span className="ml-2 text-xs text-brand-muted">{row.memberNo}</span>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-brand-muted">
          {row.phone && <span>{row.phone}</span>}
          {row.sessionsRemaining !== null && (
            <span className={lowCredits ? "text-red-300" : undefined}>
              {row.sessionsRemaining} ders kaldı
            </span>
          )}
          {expiringSoon && (
            <span className="text-red-300">
              üyelik {row.membershipDaysLeft} gün
            </span>
          )}
          {!row.hasAccount && <span>hesap kurulmadı</span>}
          {row.hasAccount && !row.remindersEnabled && (
            <span>hatırlatma kapalı</span>
          )}
        </div>
      </div>

      {/* Yoklama telefondan, ayakta, tek elle alınıyor: mobilde "Geldi" ve
          "Gelmedi" satırın altına yarım genişlikte serilir — yan yana duran
          iki dar hedef olarak değil. */}
      <div className="flex flex-wrap items-center gap-2">
        {row.status === "katildi" && <Pill tone="yellow">Geldi</Pill>}
        {row.status === "gelmedi" && <Pill tone="danger">Yanan ders</Pill>}

        {row.status === "onayli" && !slotPast && (
          <RemindButton
            bookingId={row.bookingId}
            disabled={!row.hasAccount || !row.remindersEnabled}
            disabledReason={
              !row.hasAccount
                ? "Sporcu hesabını kurmadı — telefonla ara."
                : "Sporcu hatırlatmaları kapatmış."
            }
          />
        )}

        {(row.status === "onayli" || slotPast) && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <form action={markAttendanceAction.bind(null, row.bookingId, true)}>
              <button
                type="submit"
                aria-label={`${row.fullName} geldi olarak işaretle`}
                className={`w-full ${row.status === "katildi" ? rowButtonClass : rowPrimaryButtonClass}`}
              >
                Geldi
              </button>
            </form>
            <form action={markAttendanceAction.bind(null, row.bookingId, false)}>
              <button
                type="submit"
                aria-label={`${row.fullName} gelmedi olarak işaretle`}
                className={`w-full ${rowButtonClass}`}
              >
                Gelmedi
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

export default async function StaffTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>;
}) {
  const { gun } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);
  // Antrenör kendi açtığı seansları görür, yönetici salonun tamamını.
  const scope = staffScopeFor(membership, user.id);

  const todayKey = toGymDateKey(new Date());
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(gun ?? "") ? gun! : todayKey;
  const day = await getDayView(scope, dateKey);

  const dayDate = new Date(`${dateKey}T12:00:00.000Z`);
  const isToday = dateKey === todayKey;

  return (
    <PanelPage
      title={isToday ? "Bugün" : formatDayTR(dayDate)}
      description={
        isOrganizationWide(scope)
          ? "Salonun o günkü tüm seansları, kimin geldiği ve kimin hatırlatılması gerektiği. Yoklama buradan tek dokunuşla alınır."
          : "Senin o günkü derslerin: saati, kimin geleceği ve kimin hatırlatılması gerektiği. Yoklama buradan tek dokunuşla alınır."
      }
      action={
        <div className="flex items-center gap-2">
          <Link
            href={`/personel/bugun?gun=${shiftDateKey(dateKey, -1)}`}
            className={rowButtonClass}
          >
            ← Önceki
          </Link>
          {!isToday && (
            <Link href="/personel/bugun" className={rowButtonClass}>
              Bugün
            </Link>
          )}
          <Link
            href={`/personel/bugun?gun=${shiftDateKey(dateKey, 1)}`}
            className={rowButtonClass}
          >
            Sonraki →
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Seans" value={day.slots.length} hint={formatDayTR(dayDate)} />
        <StatCard
          label="Kayıtlı Sporcu"
          value={day.totalSeats}
          suffix={`/ ${day.totalCapacity}`}
          hint="Dolu kontenjan"
        />
        <StatCard
          label="Yoklama Bekliyor"
          value={day.attendancePending}
          highlight={day.attendancePending > 0}
          hint="Seans bitti, işaretlenmedi"
        />
        <StatCard
          label="Hesapsız Sporcu"
          value={day.withoutAccount}
          highlight={day.withoutAccount > 0}
          hint="Bildirim gitmiyor"
        />
      </div>

      {day.slots.length === 0 ? (
        <PanelCard title="Bu gün için seans yok">
          <EmptyState>
            Bu güne açık saat yok.{" "}
            <Link
              href="/personel/program"
              className="font-semibold text-brand-yellow hover:underline"
            >
              Ders programından
            </Link>{" "}
            yeni saat açabilirsin.
          </EmptyState>
        </PanelCard>
      ) : (
        day.slots.map((slot) => {
          const kindLabel = SLOT_KIND_LABEL[slot.kind] ?? slot.kind;
          const cancelled = slot.status === "iptal";

          return (
            <PanelCard
              key={slot.id}
              title={`${formatTimeTR(slot.startsAt)} · ${slot.title ?? kindLabel}`}
              description={`${slot.durationMinutes} dk · ${slot.roster.length}/${slot.capacity} kişi${
                slot.notes ? ` · ${slot.notes}` : ""
              }`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {cancelled && <Pill tone="danger">İptal</Pill>}
                  {slot.inProgress && <Pill tone="yellow">Şu an</Pill>}
                  {slot.needsAttendance && (
                    <Pill tone="danger">Yoklama bekliyor</Pill>
                  )}
                  {slot.emptySeats > 0 && !slot.past && (
                    <Pill>{slot.emptySeats} boş yer</Pill>
                  )}
                </div>
              }
            >
              {slot.roster.length === 0 ? (
                <EmptyState>
                  Bu saate kimse kaydolmadı.
                  {!slot.past &&
                    " Boş saatler sporcuların ders programı ekranında görünüyor."}
                </EmptyState>
              ) : (
                <ul className="divide-y divide-brand-border">
                  {slot.roster.map((row) => (
                    <MemberRow key={row.bookingId} row={row} slotPast={slot.past} />
                  ))}
                </ul>
              )}

              {slot.pending.length > 0 && (
                <div className="mt-4 rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                    Katılım isteği ({slot.pending.length})
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {slot.pending.map((row) => (
                      <li
                        key={row.bookingId}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-sm text-brand-white">
                          {row.fullName}
                          <span className="ml-2 text-xs text-brand-muted">
                            {BOOKING_STATUS_LABEL[row.status]}
                          </span>
                        </span>
                        <form
                          action={approveRequestAction.bind(null, row.bookingId)}
                        >
                          <button type="submit" className={rowPrimaryButtonClass}>
                            Onayla
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {slot.past && !slot.needsAttendance && slot.status === "acik" && (
                <form
                  action={closeSlotAction.bind(null, slot.id)}
                  className="mt-4"
                >
                  <button type="submit" className={rowButtonClass}>
                    Seansı Kapat
                  </button>
                </form>
              )}
            </PanelCard>
          );
        })
      )}
    </PanelPage>
  );
}
