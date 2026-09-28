import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { getDayView, type DayRosterMember } from "@/lib/queries/today";
import { SLOT_KIND_LABEL, countSlotsNeedingAttendance, listSlots } from "@/lib/queries/slots";
import { buildWeekShift } from "@/domain/coaching/week-shift";
import { BOOKING_STATUS_LABEL } from "@/domain/booking/credits";
import {
  addGymDays,
  formatTimeTR,
  getWeekStartInstant,
} from "@/lib/date";
import { EmptyState, PanelCard, PanelPage, Pill } from "@/components/panel/ui";
import { headerLinkClass, primaryButtonClass } from "@/components/panel/form";

export const metadata: Metadata = {
  title: "Genel Bakış — BlackBox Panel",
};

export const dynamic = "force-dynamic";

const DAY_NAME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  weekday: "long",
});
const DAY_DATE = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
});

/** "12 ders kaldı" · "Sınırsız" · "Paket yok" — sporcunun bugün kaç hakkı kaldığı. */
function remainingLabel(row: DayRosterMember): string {
  if (!row.hasPackage) return "Paket yok";
  if (row.sessionsRemaining === null) return "Sınırsız";
  return `${row.sessionsRemaining} ders kaldı`;
}

/**
 * KOÇ ANA SAYFASI — yalnızca iki şey: **bugün kimin dersi var (ve kaç dersi
 * kaldı)** ve **bu haftaki shift**. İnceleme kuyruğu, sayaç kartları, son
 * hareketler gibi ayrıntılar bilerek yok; ders arasında telefondan bakılan
 * ekran sade kalsın. Ayrıntı için menüde ilgili bölüm duruyor.
 */
export default async function StaffHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  // Antrenör yalnız kendi açtığı seansları görür; yönetici salonun tamamını.
  const scope = staffScopeFor(membership, user.id);

  const now = new Date();
  const weekStart = getWeekStartInstant(now);
  const weekEnd = addGymDays(weekStart, 7);

  const [day, weekSlots, pendingAttendance] = await Promise.all([
    getDayView(scope),
    listSlots(scope, { from: weekStart, to: weekEnd }),
    countSlotsNeedingAttendance(scope),
  ]);

  const todaySlots = day.slots.filter((slot) => slot.status !== "iptal");
  const shift = buildWeekShift(weekSlots, weekStart, now);

  return (
    <PanelPage
      title="Genel Bakış"
      description={`Bugün: ${DAY_NAME.format(now)}, ${DAY_DATE.format(now)}`}
      action={
        <Link href="/personel/uyeler" className={primaryButtonClass}>
          Yeni Üye Ekle
        </Link>
      }
    >
      <PanelCard
        title="Bugünün Dersleri"
        description={
          todaySlots.length === 0
            ? undefined
            : `${todaySlots.length} seans · ${day.totalSeats} sporcu`
        }
        action={
          <Link href="/personel/program/yoklama" className={headerLinkClass}>
            {pendingAttendance > 0
              ? `Yoklama bekleyen ${pendingAttendance}`
              : "Yoklama"}
          </Link>
        }
      >
        {todaySlots.length === 0 ? (
          <EmptyState>
            Bugün için ders yok. Saat açmak için{" "}
            <Link
              href="/personel/program"
              className="font-semibold text-brand-yellow hover:text-brand-white"
            >
              Saatlerim
            </Link>{" "}
            bölümüne git.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {todaySlots.map((slot) => (
              <li key={slot.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-base font-semibold text-brand-white">
                      {formatTimeTR(slot.startsAt)}
                    </span>
                    <span className="ml-2 text-xs text-brand-muted">
                      {slot.durationMinutes} dk ·{" "}
                      {SLOT_KIND_LABEL[slot.kind] ?? slot.kind}
                      {slot.title ? ` · ${slot.title}` : ""}
                    </span>
                  </div>
                  {slot.needsAttendance && (
                    <Pill tone="danger">Yoklama bekliyor</Pill>
                  )}
                </div>

                {slot.roster.length === 0 ? (
                  <p className="mt-2 text-sm text-brand-muted">
                    Boş saat — kimse almadı.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {slot.roster.map((member) => (
                      <li
                        key={member.bookingId}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <Link
                          href={`/personel/uyeler/${member.memberId}`}
                          className="text-sm font-semibold text-brand-white hover:text-brand-yellow"
                        >
                          {member.fullName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          {(member.status === "katildi" ||
                            member.status === "gelmedi") && (
                            <Pill
                              tone={member.status === "katildi" ? "yellow" : "danger"}
                            >
                              {BOOKING_STATUS_LABEL[member.status]}
                            </Pill>
                          )}
                          <span
                            className={`text-xs font-semibold ${
                              !member.hasPackage ||
                              (member.sessionsRemaining !== null &&
                                member.sessionsRemaining <= 2)
                                ? "text-red-300"
                                : "text-brand-muted"
                            }`}
                          >
                            {remainingLabel(member)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="Haftalık Shift"
        description="Bu hafta hangi gün hangi saatlerde çalışıyorsun."
        action={
          <Link href="/personel/program" className={headerLinkClass}>
            Saatlerim
          </Link>
        }
      >
        <ul className="divide-y divide-brand-border">
          {shift.map((entry) => (
            <li
              key={entry.dateKey}
              className={`flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0 ${
                entry.isToday ? "text-brand-white" : ""
              }`}
            >
              <div className="w-32 shrink-0">
                <div
                  className={`text-sm font-semibold capitalize ${
                    entry.isToday ? "text-brand-yellow" : "text-brand-white"
                  }`}
                >
                  {DAY_NAME.format(entry.date)}
                </div>
                <div className="text-xs text-brand-muted">
                  {DAY_DATE.format(entry.date)}
                  {entry.isToday ? " · bugün" : ""}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                {entry.ranges.length === 0 ? (
                  <span className="text-xs text-brand-muted">Shift yok</span>
                ) : (
                  entry.ranges.map((range) => (
                    <span
                      key={`${range.start}-${range.end}`}
                      className="rounded-sm border border-brand-border bg-brand-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-white"
                      title={`${range.slotCount} seans, ${range.takenSeats}/${range.capacity} dolu`}
                    >
                      {range.start}–{range.end}
                      <span className="ml-1.5 font-normal text-brand-muted">
                        {range.takenSeats}/{range.capacity}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      </PanelCard>
    </PanelPage>
  );
}
