import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { SLOT_KIND_LABEL, listMemberBookings } from "@/lib/queries/slots";
import {
  BOOKING_STATUS_LABEL,
  canCancelBooking,
  CANCEL_CUTOFF_HOURS,
} from "@/domain/booking/credits";
import { summarizeAttendance } from "@/domain/performance/progress";
import { formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { cancelBookingAction } from "../program/actions";
import { primaryButtonClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Derslerim — BlackBox Panel" };

export default async function MemberBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const bookings = await listMemberBookings(member.id);
  const now = new Date();

  const upcoming = bookings
    .filter(
      (booking) =>
        booking.startsAt > now &&
        (booking.status === "onayli" || booking.status === "bekliyor"),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const past = bookings.filter(
    (booking) => booking.startsAt <= now || booking.status === "katildi" || booking.status === "gelmedi",
  );

  const attendance = summarizeAttendance(
    bookings.map((booking) => ({
      status: booking.status,
      startsAt: booking.startsAt,
    })),
  );

  return (
    <PanelPage
      title="Rezervasyonlarım"
      description="Yaklaşan derslerin ve geçmiş katılım kaydın."
      action={
        <Link
          href="/uye/program"
          className={primaryButtonClass}
        >
          Boş Saatler
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Yaklaşan" value={upcoming.length} />
        <StatCard label="Katıldığın" value={attendance.attended} />
        <StatCard
          label="Gelmediğin"
          value={attendance.missed}
          highlight={attendance.missed > 0}
        />
        <StatCard
          label="Katılım Oranı"
          value={attendance.ratePercent === null ? "—" : `%${attendance.ratePercent}`}
          hint="Yoklaması alınan dersler"
        />
      </div>

      <PanelCard
        title={`Yaklaşan Dersler (${upcoming.length})`}
        description={`Seansa ${CANCEL_CUTOFF_HOURS} saatten az kaldıysa iptal kapanır — o saat senin için tutuldu.`}
      >
        {upcoming.length === 0 ? (
          <EmptyState>
            Yaklaşan dersin yok — Boş Saatler ekranından bir saat kapabilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {upcoming.map((booking) => {
              const cancellable = canCancelBooking(booking.startsAt, now);

              return (
                <li
                  key={booking.bookingId}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {formatDateTimeTR(booking.startsAt)}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {booking.durationMinutes} dk ·{" "}
                      {SLOT_KIND_LABEL[booking.kind] ?? booking.kind}
                      {booking.title ? ` · ${booking.title}` : ""}
                      {booking.others.length > 0
                        ? ` · birlikte: ${booking.others.join(", ")}`
                        : booking.capacity > 1
                          ? " · grup dersi"
                          : " · birebir"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={booking.status === "bekliyor" ? "neutral" : "yellow"}>
                      {BOOKING_STATUS_LABEL[booking.status]}
                    </Pill>
                    {/* Bekleme listesindeki sıra: yer boşalırsa antrenör
                        onayı beklemeden sıradaki kişi otomatik geçer. */}
                    {booking.queuePosition !== null && (
                      <Pill
                        title="Yer açılırsa sırayla geçilir; sana bildirim gelir."
                      >
                        Sırada {booking.queuePosition}.
                      </Pill>
                    )}
                    {cancellable ? (
                      <form
                        action={cancelBookingAction.bind(null, booking.bookingId)}
                      >
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300 sm:min-h-8"
                        >
                          İptal Et
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-brand-muted">
                        İptal süresi doldu
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard title={`Geçmiş (${past.length})`}>
        {past.length === 0 ? (
          <EmptyState>Henüz geçmiş dersin yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {past.slice(0, 30).map((booking) => (
              <li
                key={booking.bookingId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm text-brand-white">
                    {formatDateTimeTR(booking.startsAt)}
                  </span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {SLOT_KIND_LABEL[booking.kind] ?? booking.kind} ·{" "}
                    {booking.durationMinutes} dk
                  </span>
                </div>
                <Pill
                  tone={
                    booking.status === "katildi"
                      ? "yellow"
                      : booking.status === "gelmedi"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {BOOKING_STATUS_LABEL[booking.status]}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
